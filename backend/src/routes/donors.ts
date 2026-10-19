import { Router } from "express";
import { getContractForRole } from "../fabric/gatewayManager";
import { AuthenticatedRequest, requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

interface ContributionRecord {
  docType: "CONTRIBUTION";
  contributionId: string;
  fundId: string;
  donorId: string;
  amountLkr: number;
  recordedAt: string;
}

interface DisbursementRecord {
  docType: "DISBURSEMENT";
  disbursementId: string;
  fundId: string;
  amountLkr: number;
  category: string;
  beneficiaryCount: number;
  predictedImpactLevel: "Low" | "Medium" | "High";
  status: string;
  actualImpactLevel?: "Low" | "Medium" | "High";
}

type FundOrContributionOrDisbursement = ContributionRecord | DisbursementRecord;

/**
 * FR5 / Objective 3: a running, real-time view of a donor's own
 * cumulative impact ACROSS EVERY FUND they've given to - not just the
 * one fund the Donor page's "Open a Fund" form happens to have loaded
 * (frontend/src/app/donor/page.tsx's existing view is per-fund). This is
 * the route a donor's dashboard calls right after a contribution, to
 * show their updated totals pulled live from the ledger.
 *
 * Scoped to the caller's own JWT `sub`, never a path param: the ledger's
 * Donor role is a single shared Fabric identity (see
 * fabric-network/03_enroll_users.sh), so individual attribution only
 * exists at the application layer via the JWT - a donor must not be able
 * to request anyone else's totals through this route.
 */
router.get("/me/impact", requireRole("Donor"), async (req: AuthenticatedRequest, res) => {
  const donorId = req.user!.sub;
  try {
    const contract = getContractForRole(req.user!.role);

    const contributionsBytes = await contract.evaluateTransaction("GetAllTransactionsForDonor", donorId);
    const contributions = JSON.parse(Buffer.from(contributionsBytes).toString("utf8")) as ContributionRecord[];

    const totalDonatedLkr = contributions.reduce((sum, c) => sum + Number(c.amountLkr), 0);
    const fundIds = Array.from(new Set(contributions.map((c) => c.fundId)));

    // Pull each supported fund's full transaction set once, so we can
    // report the beneficiaries reached / impact-level mix of the funds
    // this donor's money went into. This is fund-level attribution, same
    // as the existing fund-manager and donor pages already use - the
    // ledger does not link one specific disbursement to one specific
    // contribution, so "my beneficiaries reached" is necessarily the
    // supported fund's own totals, not an individually-earmarked share.
    const fundSummaries = await Promise.all(
      fundIds.map(async (fundId) => {
        const [fundBytes, txBytes] = await Promise.all([
          contract.evaluateTransaction("GetFund", fundId),
          contract.evaluateTransaction("GetAllTransactionsForFund", fundId),
        ]);
        const fund = JSON.parse(Buffer.from(fundBytes).toString("utf8"));
        const transactions = JSON.parse(Buffer.from(txBytes).toString("utf8")) as FundOrContributionOrDisbursement[];
        const disbursements = transactions.filter((t): t is DisbursementRecord => t.docType === "DISBURSEMENT");
        const myContributionsForFund = contributions.filter((c) => c.fundId === fundId);
        const myTotalForFund = myContributionsForFund.reduce((sum, c) => sum + Number(c.amountLkr), 0);

        return {
          fundId,
          fundName: fund.name as string,
          organizationId: fund.organizationId as string,
          status: fund.status as "OPEN" | "CLOSED",
          myTotalDonatedLkr: myTotalForFund,
          myDonationCount: myContributionsForFund.length,
          beneficiariesReached: disbursements.reduce((sum, d) => sum + Number(d.beneficiaryCount), 0),
          disbursements: disbursements.map((d) => ({
            disbursementId: d.disbursementId,
            category: d.category,
            amountLkr: d.amountLkr,
            beneficiaryCount: d.beneficiaryCount,
            predictedImpactLevel: d.predictedImpactLevel,
            actualImpactLevel: d.actualImpactLevel ?? null,
            status: d.status,
          })),
        };
      })
    );

    const allDisbursements = fundSummaries.flatMap((f) => f.disbursements);
    const impactLevelMix: Record<"Low" | "Medium" | "High", number> = { Low: 0, Medium: 0, High: 0 };
    for (const d of allDisbursements) {
      const level = d.actualImpactLevel ?? d.predictedImpactLevel;
      impactLevelMix[level] += 1;
    }

    res.json({
      donorId,
      totalDonatedLkr,
      totalDonations: contributions.length,
      fundsSupported: fundSummaries.length,
      totalBeneficiariesReached: fundSummaries.reduce((sum, f) => sum + f.beneficiariesReached, 0),
      impactLevelMix,
      funds: fundSummaries.sort((a, b) => b.myTotalDonatedLkr - a.myTotalDonatedLkr),
      recentContributions: [...contributions]
        .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
        .slice(0, 10),
    });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
