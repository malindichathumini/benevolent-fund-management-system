import axios from "axios";
import { config } from "../config";

// Matches ml_service/main.py's VALID_ORG_TYPES (v2, 2026-10-18): the old
// "International NGO" category was dropped project-wide in favor of a
// Sri Lanka-relevant 4-category taxonomy.
export type OrganizationType =
  | "Local NGO"
  | "Government-Affiliated Fund"
  | "Religious / Faith-Based Organization"
  | "Community-Based Organization (CBO)";

export interface PredictRequest {
  organization_type: OrganizationType;
  sector: string;
  cost_inflow_lkr: number;
  beneficiaries_estimate: number;
}

export interface ModelPrediction {
  predicted_impact_level: "Low" | "Medium" | "High";
  class_probabilities: Record<string, number>;
}

export interface PredictResponse {
  predicted_impact_level: "Low" | "Medium" | "High";
  class_probabilities: Record<string, number>;
  beneficiaries_per_lkr: number;
  selected_model: string;
  model_comparison: Record<string, ModelPrediction>;
}

const client = axios.create({ baseURL: config.mlServiceUrl, timeout: 5000 });

/**
 * Calls the FastAPI /predict service (ml_service/main.py, Section 4.8)
 * BEFORE a disbursement is submitted to the ledger. The prediction result
 * is then passed into the chaincode's RequestDisbursement as plain data -
 * see fund-chaincode/README.md for why the chaincode itself never calls
 * out to a live model (determinism across endorsing peers).
 */
export async function predictImpactLevel(req: PredictRequest): Promise<PredictResponse> {
  const { data } = await client.post<PredictResponse>("/predict", req);
  return data;
}
