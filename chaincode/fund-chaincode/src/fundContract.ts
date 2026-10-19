import { Context, Contract, Info, Returns, Transaction } from "fabric-contract-api";
import stringify from "json-stringify-deterministic";
import sortKeysRecursive from "sort-keys-recursive";
import {
  Contribution,
  Disbursement,
  DisbursementStatus,
  DocType,
  Fund,
  FundStatus,
  ImpactLevel,
} from "./assets";

/**
 * Chaincode implementing the fund-management business rules behind FR1-FR7
 * (Thesis Section 4.2.1). Role-based access control is enforced here via
 * the `role` attribute on each client's enrollment certificate (ABAC),
 * registered through the Fabric CA when Admin / Fund Manager / Donor users
 * are created - this is the ledger-layer half of the "Security" NFR in
 * Section 4.2.2; the application-layer half (JWT on the Node/Express API)
 * is enforced in the backend that calls this chaincode through the Fabric
 * Gateway SDK.
 */
@Info({
  title: "BenevolentFundContract",
  description: "Role-based fund, contribution, and disbursement management for Sri Lankan charitable organizations",
})
export class FundContract extends Contract {
  // ---------------------------------------------------------------------
  // Role / access-control helpers
  // ---------------------------------------------------------------------

  private getRole(ctx: Context): string {
    const role = ctx.clientIdentity.getAttributeValue("role");
    if (!role) {
      throw new Error(
        "Calling identity has no 'role' attribute on its enrollment certificate. " +
          "Users must be registered via the Fabric CA with --attrs 'role=Admin:ecert' " +
          "(or FundManager / Donor) before they can transact."
      );
    }
    return role;
  }

  private requireRole(ctx: Context, allowed: string[]): string {
    const role = this.getRole(ctx);
    if (!allowed.includes(role)) {
      throw new Error(`Access denied: role '${role}' may not perform this action (requires one of: ${allowed.join(", ")})`);
    }
    return role;
  }

  private getCallerId(ctx: Context): string {
    return ctx.clientIdentity.getID();
  }

  // Deterministic "now": chaincode must produce the same result on every
  // endorsing peer, so it reads the transaction timestamp from the
  // proposal rather than calling Date.now().
  private txTimestampIso(ctx: Context): string {
    const ts = ctx.stub.getTxTimestamp();
    const millis = ts.seconds.low * 1000 + Math.floor(ts.nanos / 1e6);
    return new Date(millis).toISOString();
  }

  private async readState<T>(ctx: Context, key: string): Promise<T> {
    const bytes = await ctx.stub.getState(key);
    if (!bytes || bytes.length === 0) {
      throw new Error(`No asset found for key ${key}`);
    }
    return JSON.parse(bytes.toString()) as T;
  }

  private async putState(ctx: Context, key: string, value: unknown): Promise<void> {
    // Deterministic key ordering (sort-keys-recursive) + deterministic
    // stringify so every endorsing peer writes byte-identical state,
    // which Fabric's endorsement-matching requires.
    await ctx.stub.putState(key, Buffer.from(stringify(sortKeysRecursive(value as Record<string, unknown>))));
  }

  private async assetExists(ctx: Context, key: string): Promise<boolean> {
    const bytes = await ctx.stub.getState(key);
    return !!bytes && bytes.length > 0;
  }

  // ---------------------------------------------------------------------
  // Funds (FR1)
  // ---------------------------------------------------------------------

  @Transaction()
  public async CreateFund(ctx: Context, fundId: string, name: string, organizationId: string): Promise<void> {
    this.requireRole(ctx, ["Admin"]);

    if (await this.assetExists(ctx, fundId)) {
      throw new Error(`A fund with ID ${fundId} already exists`);
    }

    const fund: Fund = {
      docType: DocType.FUND,
      fundId,
      name,
      organizationId,
      status: FundStatus.OPEN,
      totalContributedLkr: 0,
      totalDisbursedLkr: 0,
      createdBy: this.getCallerId(ctx),
      createdAt: this.txTimestampIso(ctx),
    };
    await this.putState(ctx, fundId, fund);
  }

  @Transaction()
  public async CloseFund(ctx: Context, fundId: string): Promise<void> {
    this.requireRole(ctx, ["Admin"]);
    const fund = await this.readState<Fund>(ctx, fundId);
    fund.status = FundStatus.CLOSED;
    await this.putState(ctx, fundId, fund);
  }

  @Transaction(false)
  @Returns("string")
  public async GetFund(ctx: Context, fundId: string): Promise<string> {
    // Readable by any authenticated role - Admin, Fund Manager, or Donor -
    // which is the real-time, permissioned transparency behaviour required
    // by Objective 2 / FR1.
    this.requireRole(ctx, ["Admin", "FundManager", "Donor"]);
    const fund = await this.readState<Fund>(ctx, fundId);
    return JSON.stringify(fund);
  }

  /**
   * Every fund on the ledger - the "browse all funds" view GetFund alone
   * cannot provide (GetFund needs the caller to already know a fundId).
   * Backs the Admin dashboard's fund directory, and is available to every
   * role for the same real-time-transparency reason GetFund is: FR1 says
   * "view the complete, immutable transaction ledger for any fund," which
   * presumes the caller can first discover what funds exist.
   */
  @Transaction(false)
  @Returns("string")
  public async ListFunds(ctx: Context): Promise<string> {
    this.requireRole(ctx, ["Admin", "FundManager", "Donor"]);

    const query = { selector: { docType: DocType.FUND } };
    const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));
    const results: unknown[] = [];
    let res = await iterator.next();
    while (!res.done) {
      if (res.value && res.value.value.toString()) {
        results.push(JSON.parse(res.value.value.toString()));
      }
      res = await iterator.next();
    }
    await iterator.close();
    return JSON.stringify(results);
  }

  // ---------------------------------------------------------------------
  // Contributions (FR4)
  // ---------------------------------------------------------------------

  @Transaction()
  public async RecordContribution(
    ctx: Context,
    fundId: string,
    contributionId: string,
    donorId: string,
    amountLkrStr: string
  ): Promise<void> {
    this.requireRole(ctx, ["Donor"]);

    const amountLkr = Number(amountLkrStr);
    if (!Number.isFinite(amountLkr) || amountLkr <= 0) {
      throw new Error(`Invalid contribution amount: ${amountLkrStr}`);
    }
    if (await this.assetExists(ctx, contributionId)) {
      throw new Error(`A contribution with ID ${contributionId} already exists`);
    }

    const fund = await this.readState<Fund>(ctx, fundId);
    if (fund.status !== FundStatus.OPEN) {
      throw new Error(`Fund ${fundId} is not open for contributions (status: ${fund.status})`);
    }

    const contribution: Contribution = {
      docType: DocType.CONTRIBUTION,
      contributionId,
      fundId,
      donorId,
      amountLkr,
      recordedAt: this.txTimestampIso(ctx),
    };
    await this.putState(ctx, contributionId, contribution);

    fund.totalContributedLkr += amountLkr;
    await this.putState(ctx, fundId, fund);
  }

  // ---------------------------------------------------------------------
  // Disbursements (FR2, FR3, FR7)
  // ---------------------------------------------------------------------

  /**
   * Fund Manager records a disbursement request. The predicted impact
   * level MUST already have been computed by the FastAPI /predict service
   * (Section 4.8) and passed in here - chaincode is executed and endorsed
   * by multiple peers and must be fully deterministic, so it cannot itself
   * call out to a live ML model.
   */
  @Transaction()
  public async RequestDisbursement(
    ctx: Context,
    fundId: string,
    disbursementId: string,
    amountLkrStr: string,
    category: string,
    beneficiaryCountStr: string,
    predictedImpactLevel: string
  ): Promise<void> {
    this.requireRole(ctx, ["FundManager"]);

    const amountLkr = Number(amountLkrStr);
    const beneficiaryCount = Number(beneficiaryCountStr);
    if (!Number.isFinite(amountLkr) || amountLkr <= 0) {
      throw new Error(`Invalid disbursement amount: ${amountLkrStr}`);
    }
    if (!Object.values(ImpactLevel).includes(predictedImpactLevel as ImpactLevel)) {
      throw new Error(`Invalid predictedImpactLevel '${predictedImpactLevel}'; must be one of Low, Medium, High`);
    }
    if (await this.assetExists(ctx, disbursementId)) {
      throw new Error(`A disbursement with ID ${disbursementId} already exists`);
    }

    const fund = await this.readState<Fund>(ctx, fundId);
    const available = fund.totalContributedLkr - fund.totalDisbursedLkr;
    if (amountLkr > available) {
      throw new Error(`Disbursement amount ${amountLkr} exceeds available fund balance ${available} for fund ${fundId}`);
    }

    const disbursement: Disbursement = {
      docType: DocType.DISBURSEMENT,
      disbursementId,
      fundId,
      amountLkr,
      category,
      beneficiaryCount,
      predictedImpactLevel: predictedImpactLevel as ImpactLevel,
      status: DisbursementStatus.PENDING_APPROVAL,
      requestedBy: this.getCallerId(ctx),
      requestedAt: this.txTimestampIso(ctx),
    };
    await this.putState(ctx, disbursementId, disbursement);
  }

  @Transaction()
  public async ApproveDisbursement(ctx: Context, disbursementId: string): Promise<void> {
    this.requireRole(ctx, ["Admin"]);

    const disbursement = await this.readState<Disbursement>(ctx, disbursementId);
    if (disbursement.status !== DisbursementStatus.PENDING_APPROVAL) {
      throw new Error(`Disbursement ${disbursementId} is not pending approval (status: ${disbursement.status})`);
    }

    const fund = await this.readState<Fund>(ctx, disbursement.fundId);
    const available = fund.totalContributedLkr - fund.totalDisbursedLkr;
    if (disbursement.amountLkr > available) {
      throw new Error(`Cannot approve: disbursement amount ${disbursement.amountLkr} exceeds current available balance ${available}`);
    }

    disbursement.status = DisbursementStatus.APPROVED;
    disbursement.approvedBy = this.getCallerId(ctx);
    disbursement.approvedAt = this.txTimestampIso(ctx);
    await this.putState(ctx, disbursementId, disbursement);

    fund.totalDisbursedLkr += disbursement.amountLkr;
    await this.putState(ctx, fund.fundId, fund);
  }

  @Transaction()
  public async RejectDisbursement(ctx: Context, disbursementId: string, reason: string): Promise<void> {
    this.requireRole(ctx, ["Admin"]);

    const disbursement = await this.readState<Disbursement>(ctx, disbursementId);
    if (disbursement.status !== DisbursementStatus.PENDING_APPROVAL) {
      throw new Error(`Disbursement ${disbursementId} is not pending approval (status: ${disbursement.status})`);
    }

    disbursement.status = DisbursementStatus.REJECTED;
    disbursement.rejectedReason = reason;
    disbursement.approvedBy = this.getCallerId(ctx);
    disbursement.approvedAt = this.txTimestampIso(ctx);
    await this.putState(ctx, disbursementId, disbursement);
  }

  /** FR3 second half: "upload an outcome report once a disbursement has taken place." */
  @Transaction()
  public async RecordOutcomeReport(
    ctx: Context,
    disbursementId: string,
    outcomeReport: string,
    actualImpactLevel: string
  ): Promise<void> {
    this.requireRole(ctx, ["FundManager"]);

    const disbursement = await this.readState<Disbursement>(ctx, disbursementId);
    if (disbursement.status !== DisbursementStatus.APPROVED) {
      throw new Error(`Cannot record an outcome for a disbursement that is not Approved (status: ${disbursement.status})`);
    }
    if (!Object.values(ImpactLevel).includes(actualImpactLevel as ImpactLevel)) {
      throw new Error(`Invalid actualImpactLevel '${actualImpactLevel}'; must be one of Low, Medium, High`);
    }

    disbursement.outcomeReport = outcomeReport;
    disbursement.actualImpactLevel = actualImpactLevel as ImpactLevel;
    disbursement.outcomeRecordedAt = this.txTimestampIso(ctx);
    await this.putState(ctx, disbursementId, disbursement);
  }

  @Transaction(false)
  @Returns("string")
  public async GetDisbursement(ctx: Context, disbursementId: string): Promise<string> {
    this.requireRole(ctx, ["Admin", "FundManager", "Donor"]);
    const disbursement = await this.readState<Disbursement>(ctx, disbursementId);
    return JSON.stringify(disbursement);
  }

  // ---------------------------------------------------------------------
  // Ledger visibility (FR1, FR5, FR6) - the "complete, immutable
  // transaction ledger" and the donor-facing real-time dashboard both read
  // through these two queries.
  // ---------------------------------------------------------------------

  /**
   * All contributions and disbursements belonging to one fund, newest
   * first by the caller's own sorting once deserialized. Requires a
   * CouchDB state database (the Fabric test-network's default "couchdb"
   * profile) since it uses a JSON rich query; LevelDB deployments would
   * need an equivalent range query over composite keys instead.
   */
  @Transaction(false)
  @Returns("string")
  public async GetAllTransactionsForFund(ctx: Context, fundId: string): Promise<string> {
    this.requireRole(ctx, ["Admin", "FundManager", "Donor"]);

    const query = {
      selector: {
        fundId,
        docType: { $in: [DocType.CONTRIBUTION, DocType.DISBURSEMENT] },
      },
    };
    const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));
    const results: unknown[] = [];
    let res = await iterator.next();
    while (!res.done) {
      if (res.value && res.value.value.toString()) {
        results.push(JSON.parse(res.value.value.toString()));
      }
      res = await iterator.next();
    }
    await iterator.close();
    return JSON.stringify(results);
  }

  /**
   * All contributions made by one donor, across EVERY fund - the ledger
   * query behind the cross-fund donor dashboard (Objective 3 / FR5): a
   * running, real-time total of a donor's own cumulative impact, instead
   * of having to look up one fund at a time the way GetAllTransactionsForFund
   * requires. Scoped to CONTRIBUTION docs only (a donorId is only ever
   * recorded on a contribution, never a disbursement).
   */
  @Transaction(false)
  @Returns("string")
  public async GetAllTransactionsForDonor(ctx: Context, donorId: string): Promise<string> {
    this.requireRole(ctx, ["Admin", "FundManager", "Donor"]);

    const query = {
      selector: {
        docType: DocType.CONTRIBUTION,
        donorId,
      },
    };
    const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));
    const results: unknown[] = [];
    let res = await iterator.next();
    while (!res.done) {
      if (res.value && res.value.value.toString()) {
        results.push(JSON.parse(res.value.value.toString()));
      }
      res = await iterator.next();
    }
    await iterator.close();
    return JSON.stringify(results);
  }

  /**
   * Full change history for a single asset key, proving the "immutable,
   * timestamped transaction record" claim (Section 4.2.3 I/O table):
   * every historical value, the tx ID that wrote it, and whether it was a
   * delete, is returned - nothing can be altered in place on the ledger.
   */
  @Transaction(false)
  @Returns("string")
  public async GetHistoryForAsset(ctx: Context, assetId: string): Promise<string> {
    this.requireRole(ctx, ["Admin", "FundManager", "Donor"]);

    const iterator = await ctx.stub.getHistoryForKey(assetId);
    const history: unknown[] = [];
    let res = await iterator.next();
    while (!res.done) {
      if (res.value) {
        history.push({
          txId: res.value.txId,
          timestamp: res.value.timestamp,
          isDelete: res.value.isDelete,
          value: res.value.value.toString() ? JSON.parse(res.value.value.toString()) : null,
        });
      }
      res = await iterator.next();
    }
    await iterator.close();
    return JSON.stringify(history);
  }
}
