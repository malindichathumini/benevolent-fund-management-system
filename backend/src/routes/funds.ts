import { Router } from "express";
import { z } from "zod";
import { getContractForRole } from "../fabric/gatewayManager";
import { AuthenticatedRequest, requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const createFundSchema = z.object({
  fundId: z.string().min(1),
  name: z.string().min(1),
  organizationId: z.string().min(1),
});

/** FR1: "create ... a charitable fund." */
router.post("/", requireRole("Admin"), async (req: AuthenticatedRequest, res) => {
  const parsed = createFundSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const contract = getContractForRole(req.user!.role);
    const { fundId, name, organizationId } = parsed.data;
    await contract.submitTransaction("CreateFund", fundId, name, organizationId);
    res.status(201).json({ fundId, name, organizationId, status: "OPEN" });
  } catch (err) {
    res.status(502).json({ error: `Ledger transaction failed: ${(err as Error).message}` });
  }
});

/**
 * Every fund on the ledger - backs the Admin dashboard's fund directory
 * (there was previously no way to discover a fundId other than already
 * knowing it, since GetFund needs one). Registered before the "/:fundId"
 * route below so Express doesn't treat the literal path "/" as a fundId.
 */
router.get("/", requireRole("Admin", "FundManager", "Donor"), async (req: AuthenticatedRequest, res) => {
  try {
    const contract = getContractForRole(req.user!.role);
    const bytes = await contract.evaluateTransaction("ListFunds");
    res.json(JSON.parse(Buffer.from(bytes).toString("utf8")));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/** FR1: "view the complete, immutable transaction ledger for any fund" starts here. */
router.get("/:fundId", requireRole("Admin", "FundManager", "Donor"), async (req: AuthenticatedRequest, res) => {
  try {
    const contract = getContractForRole(req.user!.role);
    const bytes = await contract.evaluateTransaction("GetFund", req.params.fundId);
    res.json(JSON.parse(Buffer.from(bytes).toString("utf8")));
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

router.post("/:fundId/close", requireRole("Admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const contract = getContractForRole(req.user!.role);
    await contract.submitTransaction("CloseFund", req.params.fundId);
    res.json({ fundId: req.params.fundId, status: "CLOSED" });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/** The "complete, immutable transaction ledger" view (FR1) and the data
 * the donor-facing real-time impact dashboard (FR5) is built from. */
router.get("/:fundId/transactions", requireRole("Admin", "FundManager", "Donor"), async (req: AuthenticatedRequest, res) => {
  try {
    const contract = getContractForRole(req.user!.role);
    const bytes = await contract.evaluateTransaction("GetAllTransactionsForFund", req.params.fundId);
    res.json(JSON.parse(Buffer.from(bytes).toString("utf8")));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
