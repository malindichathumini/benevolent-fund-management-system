import { Router } from "express";
import { z } from "zod";
import { getContractForRole } from "../fabric/gatewayManager";
import { AuthenticatedRequest, requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const contributeSchema = z.object({
  contributionId: z.string().min(1),
  amountLkr: z.number().positive(),
});

/** FR4: "contribute to a fund of their choice." The individual donor's
 * identity (req.user.sub) is recorded in the transaction payload even
 * though the ledger signs with the shared Donor-role identity - see
 * fabric-network/03_enroll_users.sh for why. */
router.post("/:fundId/contributions", requireRole("Donor"), async (req: AuthenticatedRequest, res) => {
  const parsed = contributeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const contract = getContractForRole(req.user!.role);
    const { contributionId, amountLkr } = parsed.data;
    await contract.submitTransaction(
      "RecordContribution",
      req.params.fundId,
      contributionId,
      req.user!.sub, // real individual donor ID, for accountability within the transaction data
      String(amountLkr)
    );
    res.status(201).json({ contributionId, fundId: req.params.fundId, donorId: req.user!.sub, amountLkr });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
