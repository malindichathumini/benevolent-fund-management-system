import { Router } from "express";
import { z } from "zod";
import { getContractForRole } from "../fabric/gatewayManager";
import { AuthenticatedRequest, requireAuth, requireRole } from "../middleware/auth";
import { predictImpactLevel } from "../services/mlService";

const router = Router();
router.use(requireAuth);

const requestDisbursementSchema = z.object({
  disbursementId: z.string().min(1),
  amountLkr: z.number().positive(),
  category: z.string().min(1),
  beneficiaryCount: z.number().positive(),
  // Matches ml_service's VALID_ORG_TYPES (v2, 2026-10-18) - "International
  // NGO" was dropped project-wide for a Sri Lanka-relevant taxonomy.
  organizationType: z.enum([
    "Local NGO",
    "Government-Affiliated Fund",
    "Religious / Faith-Based Organization",
    "Community-Based Organization (CBO)",
  ]),
});

/**
 * FR2 + FR7: "record a disbursement" + "invoke the trained ... classifier
 * to assign a predicted impact level ... and surface that prediction to
 * administrators ... before approving." This is the one route that calls
 * the ML service (Section 4.3) BEFORE touching the ledger, then submits
 * the prediction as part of the chaincode transaction.
 */
router.post("/:fundId/disbursements", requireRole("FundManager"), async (req: AuthenticatedRequest, res) => {
  const parsed = requestDisbursementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { disbursementId, amountLkr, category, beneficiaryCount, organizationType } = parsed.data;

  let predicted;
  try {
    predicted = await predictImpactLevel({
      organization_type: organizationType,
      sector: category,
      cost_inflow_lkr: amountLkr,
      beneficiaries_estimate: beneficiaryCount,
    });
  } catch (err) {
    res.status(502).json({ error: `ML prediction service unavailable: ${(err as Error).message}` });
    return;
  }

  try {
    const contract = getContractForRole(req.user!.role);
    await contract.submitTransaction(
      "RequestDisbursement",
      req.params.fundId,
      disbursementId,
      String(amountLkr),
      category,
      String(beneficiaryCount),
      predicted.predicted_impact_level
    );
    res.status(201).json({
      disbursementId,
      fundId: req.params.fundId,
      status: "PENDING_APPROVAL",
      predictedImpactLevel: predicted.predicted_impact_level,
      classProbabilities: predicted.class_probabilities,
      // The ledger write above always uses the SELECTED model's prediction
      // (Random Forest, per Section 4.6's "deploy the better-performing
      // model" rule). These extra fields are only for showing the full
      // Random Forest vs XGBoost comparison in the UI - they are never
      // themselves written to the chaincode.
      selectedModel: predicted.selected_model,
      modelComparison: predicted.model_comparison,
    });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/** FR2: "review a pending disbursement request together with the ...
 * predicted impact level before approving or rejecting it." */
router.get("/:disbursementId", requireRole("Admin", "FundManager", "Donor"), async (req: AuthenticatedRequest, res) => {
  try {
    const contract = getContractForRole(req.user!.role);
    const bytes = await contract.evaluateTransaction("GetDisbursement", req.params.disbursementId);
    res.json(JSON.parse(Buffer.from(bytes).toString("utf8")));
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

router.post("/:disbursementId/approve", requireRole("Admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const contract = getContractForRole(req.user!.role);
    await contract.submitTransaction("ApproveDisbursement", req.params.disbursementId);
    res.json({ disbursementId: req.params.disbursementId, status: "APPROVED" });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

const rejectSchema = z.object({ reason: z.string().min(1) });

router.post("/:disbursementId/reject", requireRole("Admin"), async (req: AuthenticatedRequest, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "reason is required" });
    return;
  }
  try {
    const contract = getContractForRole(req.user!.role);
    await contract.submitTransaction("RejectDisbursement", req.params.disbursementId, parsed.data.reason);
    res.json({ disbursementId: req.params.disbursementId, status: "REJECTED", reason: parsed.data.reason });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

const outcomeSchema = z.object({
  outcomeReport: z.string().min(1),
  actualImpactLevel: z.enum(["Low", "Medium", "High"]),
});

/** FR3 second half: "upload an outcome report once a disbursement has taken place." */
router.post("/:disbursementId/outcome", requireRole("FundManager"), async (req: AuthenticatedRequest, res) => {
  const parsed = outcomeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const contract = getContractForRole(req.user!.role);
    await contract.submitTransaction(
      "RecordOutcomeReport",
      req.params.disbursementId,
      parsed.data.outcomeReport,
      parsed.data.actualImpactLevel
    );
    res.json({ disbursementId: req.params.disbursementId, ...parsed.data });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
