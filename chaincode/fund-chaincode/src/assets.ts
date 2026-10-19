// Domain model for the Benevolent Fund chaincode (Thesis Section 4.4 / 4.8).
// Every asset carries a `docType` discriminator so CouchDB rich queries
// (GetAllAssetsForFund below) can filter the shared world-state key space.

export enum DocType {
  FUND = "FUND",
  CONTRIBUTION = "CONTRIBUTION",
  DISBURSEMENT = "DISBURSEMENT",
}

export enum FundStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
}

export enum DisbursementStatus {
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum ImpactLevel {
  LOW = "Low",
  MEDIUM = "Medium",
  HIGH = "High",
}

export interface Fund {
  docType: DocType.FUND;
  fundId: string;
  name: string;
  organizationId: string;
  status: FundStatus;
  totalContributedLkr: number;
  totalDisbursedLkr: number;
  createdBy: string;
  createdAt: string; // ISO timestamp, derived from tx timestamp (deterministic)
}

export interface Contribution {
  docType: DocType.CONTRIBUTION;
  contributionId: string;
  fundId: string;
  donorId: string;
  amountLkr: number;
  recordedAt: string;
}

export interface Disbursement {
  docType: DocType.DISBURSEMENT;
  disbursementId: string;
  fundId: string;
  amountLkr: number;
  category: string;
  beneficiaryCount: number;
  // Predicted by the FastAPI /predict service (Section 4.8) BEFORE this
  // transaction is submitted; the chaincode records it, it does not compute
  // it, since chaincode must be deterministic across all endorsing peers
  // and a live model call is not.
  predictedImpactLevel: ImpactLevel;
  status: DisbursementStatus;
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  outcomeReport?: string;
  actualImpactLevel?: ImpactLevel;
  outcomeRecordedAt?: string;
}

export type FundAsset = Fund | Contribution | Disbursement;
