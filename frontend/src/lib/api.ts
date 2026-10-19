"use client";

import { getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message = body?.error ? JSON.stringify(body.error) : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return body as T;
}

// ---- Auth ----
export function login(username: string, password: string) {
  return request<{ token: string; role: string; name: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// Donor self-registration (FR4, use-case diagram "Register / Login (JWT)").
// Always creates a Donor account - Admin/FundManager accounts are
// provisioned by an administrator via /users instead.
export function register(username: string, password: string, displayName: string) {
  return request<{ token: string; role: string; name: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password, displayName }),
  });
}

// ---- Funds ----
export interface Fund {
  fundId: string;
  name: string;
  organizationId: string;
  status: "OPEN" | "CLOSED";
  totalContributedLkr: number;
  totalDisbursedLkr: number;
  createdBy: string;
  createdAt: string;
}

export function createFund(fundId: string, name: string, organizationId: string) {
  return request<Fund>("/funds", { method: "POST", body: JSON.stringify({ fundId, name, organizationId }) });
}

export function listFunds() {
  return request<Fund[]>("/funds");
}

export function getFund(fundId: string) {
  return request<Fund>(`/funds/${encodeURIComponent(fundId)}`);
}

export function closeFund(fundId: string) {
  return request<{ fundId: string; status: "CLOSED" }>(`/funds/${encodeURIComponent(fundId)}/close`, { method: "POST" });
}

export interface LedgerEntry {
  docType: "CONTRIBUTION" | "DISBURSEMENT";
  [key: string]: unknown;
}

export function getFundTransactions(fundId: string) {
  return request<LedgerEntry[]>(`/funds/${encodeURIComponent(fundId)}/transactions`);
}

// ---- Contributions ----
export function contribute(fundId: string, contributionId: string, amountLkr: number) {
  return request(`/funds/${encodeURIComponent(fundId)}/contributions`, {
    method: "POST",
    body: JSON.stringify({ contributionId, amountLkr }),
  });
}

// ---- Disbursements ----
export interface ModelPrediction {
  predicted_impact_level: "Low" | "Medium" | "High";
  class_probabilities: Record<string, number>;
}

export interface DisbursementPredictionResult {
  disbursementId: string;
  fundId: string;
  status: string;
  predictedImpactLevel: "Low" | "Medium" | "High";
  classProbabilities: Record<string, number>;
  selectedModel: string;
  modelComparison: Record<string, ModelPrediction>;
}

// Matches the backend's requestDisbursementSchema / ml_service's
// VALID_ORG_TYPES (v2, 2026-10-18) - "International NGO" was dropped
// project-wide in favor of a Sri Lanka-relevant 4-category taxonomy.
export type OrganizationType =
  | "Local NGO"
  | "Government-Affiliated Fund"
  | "Religious / Faith-Based Organization"
  | "Community-Based Organization (CBO)";

export function requestDisbursement(
  fundId: string,
  params: {
    disbursementId: string;
    amountLkr: number;
    category: string;
    beneficiaryCount: number;
    organizationType: OrganizationType;
  }
) {
  return request<DisbursementPredictionResult>(`/disbursements/${encodeURIComponent(fundId)}/disbursements`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function approveDisbursement(disbursementId: string) {
  return request(`/disbursements/${encodeURIComponent(disbursementId)}/approve`, { method: "POST" });
}

export function rejectDisbursement(disbursementId: string, reason: string) {
  return request(`/disbursements/${encodeURIComponent(disbursementId)}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function recordOutcome(disbursementId: string, outcomeReport: string, actualImpactLevel: "Low" | "Medium" | "High") {
  return request(`/disbursements/${encodeURIComponent(disbursementId)}/outcome`, {
    method: "POST",
    body: JSON.stringify({ outcomeReport, actualImpactLevel }),
  });
}

export function getAssetHistory(assetId: string) {
  return request<unknown[]>(`/assets/${encodeURIComponent(assetId)}/history`);
}

// ---- Donor impact (cross-fund dashboard, Objective 3 / FR5) ----
export interface DonorFundImpact {
  fundId: string;
  fundName: string;
  organizationId: string;
  status: "OPEN" | "CLOSED";
  myTotalDonatedLkr: number;
  myDonationCount: number;
  beneficiariesReached: number;
  disbursements: {
    disbursementId: string;
    category: string;
    amountLkr: number;
    beneficiaryCount: number;
    predictedImpactLevel: "Low" | "Medium" | "High";
    actualImpactLevel: "Low" | "Medium" | "High" | null;
    status: string;
  }[];
}

export interface DonorImpactSummary {
  donorId: string;
  totalDonatedLkr: number;
  totalDonations: number;
  fundsSupported: number;
  totalBeneficiariesReached: number;
  impactLevelMix: Record<"Low" | "Medium" | "High", number>;
  funds: DonorFundImpact[];
  recentContributions: {
    contributionId: string;
    fundId: string;
    amountLkr: number;
    recordedAt: string;
  }[];
}

export function getDonorImpact() {
  return request<DonorImpactSummary>("/donors/me/impact");
}
