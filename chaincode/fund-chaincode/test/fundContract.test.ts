import { expect } from "chai";
import { Context } from "fabric-contract-api";
import { FundContract } from "../src/fundContract";

/**
 * Lightweight in-memory fake of the Fabric ChaincodeStub + ClientIdentity,
 * enough to exercise the contract's business logic without a real peer.
 * This is a logic smoke test, not a substitute for running the contract
 * against the actual test-network (Section 3.9 / Section 5.4.1).
 */
class FakeStub {
  public state = new Map<string, Buffer>();

  async getState(key: string): Promise<Buffer> {
    return this.state.get(key) ?? Buffer.from("");
  }

  async putState(key: string, value: Buffer): Promise<void> {
    this.state.set(key, value);
  }

  getTxTimestamp() {
    const nowMs = Date.now();
    return { seconds: { low: Math.floor(nowMs / 1000) }, nanos: (nowMs % 1000) * 1e6 };
  }

  async getQueryResult(queryString: string) {
    // Minimal in-memory stand-in for CouchDB's rich query: just enough to
    // exercise GetAllTransactionsForFund / GetAllTransactionsForDonor's
    // selector shape ({ docType, fundId? , donorId? }) against the fake
    // world state, without a real CouchDB instance.
    const { selector } = JSON.parse(queryString) as { selector: Record<string, unknown> };
    const docTypes = (selector.docType as { $in?: string[] } | string | undefined);
    const allowedDocTypes = typeof docTypes === "string" ? [docTypes] : docTypes?.$in;

    const matches: Buffer[] = [];
    for (const bytes of this.state.values()) {
      if (!bytes.length) continue;
      const value = JSON.parse(bytes.toString());
      if (allowedDocTypes && !allowedDocTypes.includes(value.docType)) continue;
      if (selector.fundId !== undefined && value.fundId !== selector.fundId) continue;
      if (selector.donorId !== undefined && value.donorId !== selector.donorId) continue;
      matches.push(bytes);
    }

    let i = 0;
    return {
      next: async () => (i < matches.length ? { done: false, value: { value: matches[i++] } } : { done: true, value: undefined }),
      close: async () => undefined,
    };
  }

  async getHistoryForKey() {
    return { next: async () => ({ done: true, value: undefined }), close: async () => undefined };
  }
}

class FakeClientIdentity {
  constructor(private role: string, private id = "x509::/CN=test-user") {}
  getAttributeValue(name: string): string | null {
    return name === "role" ? this.role : null;
  }
  getID(): string {
    return this.id;
  }
}

function makeCtx(role: string): Context {
  return { stub: new FakeStub(), clientIdentity: new FakeClientIdentity(role) } as unknown as Context;
}

describe("FundContract", () => {
  it("lets an Admin create a fund, rejects a Donor doing the same", async () => {
    const contract = new FundContract();
    const adminCtx = makeCtx("Admin");
    await contract.CreateFund(adminCtx, "fund1", "Flood Relief 2026", "org-123");
    const fundJson = await contract.GetFund(adminCtx, "fund1");
    const fund = JSON.parse(fundJson);
    expect(fund.status).to.equal("OPEN");
    expect(fund.totalContributedLkr).to.equal(0);

    const donorCtx = makeCtx("Donor");
    try {
      await contract.CreateFund(donorCtx, "fund2", "Should Fail", "org-123");
      expect.fail("Donor should not be able to create a fund");
    } catch (err) {
      expect((err as Error).message).to.match(/Access denied/);
    }
  });

  it("records a contribution and updates the fund balance (FR4)", async () => {
    const contract = new FundContract();
    const adminCtx = makeCtx("Admin");
    const stub = adminCtx.stub; // shared fake world state across role-switched contexts below
    await contract.CreateFund(adminCtx, "fund1", "Education Fund", "org-1");

    const donorCtx = { stub, clientIdentity: new FakeClientIdentity("Donor") } as unknown as Context;
    await contract.RecordContribution(donorCtx, "fund1", "contrib1", "donor-1", "50000");

    const fund = JSON.parse(await contract.GetFund(donorCtx, "fund1"));
    expect(fund.totalContributedLkr).to.equal(50000);
  });

  it("runs the full disbursement request -> approve flow and tracks balances (FR2, FR3)", async () => {
    const contract = new FundContract();
    const adminCtx = makeCtx("Admin");
    const stub = adminCtx.stub;
    await contract.CreateFund(adminCtx, "fund1", "Medical Fund", "org-1");

    const donorCtx = { stub, clientIdentity: new FakeClientIdentity("Donor") } as unknown as Context;
    await contract.RecordContribution(donorCtx, "fund1", "contrib1", "donor-1", "100000");

    const fmCtx = { stub, clientIdentity: new FakeClientIdentity("FundManager") } as unknown as Context;
    await contract.RequestDisbursement(fmCtx, "fund1", "disb1", "60000", "Health", "40", "High");

    let disbursement = JSON.parse(await contract.GetDisbursement(fmCtx, "disb1"));
    expect(disbursement.status).to.equal("PENDING_APPROVAL");
    expect(disbursement.predictedImpactLevel).to.equal("High");

    // Over-budget request should be rejected outright
    try {
      await contract.RequestDisbursement(fmCtx, "fund1", "disb2", "999999999", "Health", "1", "Low");
      expect.fail("should have exceeded available balance");
    } catch (err) {
      expect((err as Error).message).to.match(/exceeds available fund balance/);
    }

    await contract.ApproveDisbursement(adminCtx, "disb1");
    disbursement = JSON.parse(await contract.GetDisbursement(adminCtx, "disb1"));
    expect(disbursement.status).to.equal("APPROVED");

    const fund = JSON.parse(await contract.GetFund(adminCtx, "fund1"));
    expect(fund.totalDisbursedLkr).to.equal(60000);

    await contract.RecordOutcomeReport(fmCtx, "disb1", "Treated 40 patients at the mobile clinic.", "High");
    disbursement = JSON.parse(await contract.GetDisbursement(adminCtx, "disb1"));
    expect(disbursement.actualImpactLevel).to.equal("High");
  });

  it("aggregates one donor's contributions across every fund, ignoring other donors (FR5 / Objective 3)", async () => {
    const contract = new FundContract();
    const adminCtx = makeCtx("Admin");
    const stub = adminCtx.stub;
    await contract.CreateFund(adminCtx, "fund1", "Flood Relief", "org-1");
    await contract.CreateFund(adminCtx, "fund2", "School Supplies", "org-2");

    const donorCtx = { stub, clientIdentity: new FakeClientIdentity("Donor") } as unknown as Context;
    await contract.RecordContribution(donorCtx, "fund1", "contrib1", "donor-1", "50000");
    await contract.RecordContribution(donorCtx, "fund2", "contrib2", "donor-1", "25000");
    // A different donor's contribution must not leak into donor-1's totals.
    await contract.RecordContribution(donorCtx, "fund1", "contrib3", "donor-2", "999999");

    const resultsJson = await contract.GetAllTransactionsForDonor(donorCtx, "donor-1");
    const results = JSON.parse(resultsJson) as Array<{ fundId: string; amountLkr: number; donorId: string }>;

    expect(results).to.have.length(2);
    expect(results.every((r) => r.donorId === "donor-1")).to.equal(true);
    const totalLkr = results.reduce((sum, r) => sum + r.amountLkr, 0);
    expect(totalLkr).to.equal(75000);
    expect(new Set(results.map((r) => r.fundId))).to.deep.equal(new Set(["fund1", "fund2"]));
  });

  it("lists every fund on the ledger, not just contributions/disbursements (Admin fund directory)", async () => {
    const contract = new FundContract();
    const adminCtx = makeCtx("Admin");
    const stub = adminCtx.stub;
    await contract.CreateFund(adminCtx, "fund1", "Flood Relief", "org-1");
    await contract.CreateFund(adminCtx, "fund2", "School Supplies", "org-2");
    await contract.CloseFund(adminCtx, "fund2");

    const donorCtx = { stub, clientIdentity: new FakeClientIdentity("Donor") } as unknown as Context;
    // A contribution and a disbursement also live in world state under
    // their own keys - ListFunds must filter those out via docType.
    await contract.RecordContribution(donorCtx, "fund1", "contrib1", "donor-1", "10000");

    const fundsJson = await contract.ListFunds(adminCtx);
    const funds = JSON.parse(fundsJson) as Array<{ fundId: string; status: string; docType: string }>;

    expect(funds).to.have.length(2);
    expect(funds.every((f) => f.docType === "FUND")).to.equal(true);
    const byId = Object.fromEntries(funds.map((f) => [f.fundId, f.status]));
    expect(byId).to.deep.equal({ fund1: "OPEN", fund2: "CLOSED" });
  });
});
