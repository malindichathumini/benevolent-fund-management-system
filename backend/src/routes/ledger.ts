import { Router } from "express";
import { getContractForRole } from "../fabric/gatewayManager";
import { AuthenticatedRequest, requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

/** Full, tamper-evident change history for any asset key (fund,
 * contribution, or disbursement) - the concrete proof behind the
 * "immutable, timestamped transaction record" claim in Section 4.2.3. */
router.get("/assets/:assetId/history", requireRole("Admin", "FundManager", "Donor"), async (req: AuthenticatedRequest, res) => {
  try {
    const contract = getContractForRole(req.user!.role);
    const bytes = await contract.evaluateTransaction("GetHistoryForAsset", req.params.assetId);
    res.json(JSON.parse(Buffer.from(bytes).toString("utf8")));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
