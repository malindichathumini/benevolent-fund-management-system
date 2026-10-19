"use client";

import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FolderOpen,
  HandCoins,
  Receipt,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import ImpactBadge from "@/components/ImpactBadge";
import {
  ApiError,
  DisbursementPredictionResult,
  Fund,
  getFund,
  getFundTransactions,
  LedgerEntry,
  OrganizationType,
  recordOutcome,
  requestDisbursement,
} from "@/lib/api";

const ORGANIZATION_TYPES: OrganizationType[] = [
  "Local NGO",
  "Government-Affiliated Fund",
  "Religious / Faith-Based Organization",
  "Community-Based Organization (CBO)",
];

// Must match ml_service/main.py's VALID_SECTORS exactly - the ML model
// rejects (422) any sector string outside this fixed list, so this is a
// dropdown rather than free text to prevent that mismatch at submission
// time instead of after a failed round trip to the backend.
const SECTORS = [
  "Child welfare",
  "Education",
  "Emergency relief",
  "Environment",
  "Governance / human rights",
  "Health",
  "Livelihoods",
  "Multi-sector relief & welfare",
  "Peacebuilding",
  "Poverty alleviation",
  "Religious / community welfare",
  "WASH / infrastructure",
];

const NAV_ITEMS = [
  { label: "Open Fund", href: "#open-fund", icon: <FolderOpen className="h-[18px] w-[18px]" /> },
  { label: "Request Disbursement", href: "#request-disbursement", icon: <HandCoins className="h-[18px] w-[18px]" /> },
  { label: "Outcome Reports", href: "#outcome-reports", icon: <ClipboardCheck className="h-[18px] w-[18px]" /> },
  { label: "Ledger", href: "#ledger", icon: <Receipt className="h-[18px] w-[18px]" /> },
];

export default function FundManagerPage() {
  const [fundId, setFundId] = useState("");
  const [fund, setFund] = useState<Fund | null>(null);
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Disbursement request form (FR2 / FR7)
  const [disbursementId, setDisbursementId] = useState("");
  const [amountLkr, setAmountLkr] = useState("");
  const [category, setCategory] = useState(SECTORS[0]);
  const [beneficiaryCount, setBeneficiaryCount] = useState("");
  const [organizationType, setOrganizationType] = useState<OrganizationType>("Local NGO");
  const [submitting, setSubmitting] = useState(false);
  const [prediction, setPrediction] = useState<DisbursementPredictionResult | null>(null);

  // Outcome report form (FR3)
  const [outcomeDisbursementId, setOutcomeDisbursementId] = useState("");
  const [outcomeReport, setOutcomeReport] = useState("");
  const [actualImpactLevel, setActualImpactLevel] = useState<"Low" | "Medium" | "High">("Medium");
  const [submittingOutcome, setSubmittingOutcome] = useState(false);

  async function loadFund(id: string) {
    setError(null);
    try {
      const [f, txs] = await Promise.all([getFund(id), getFundTransactions(id)]);
      setFund(f);
      setTransactions(txs);
      setFundId(id);
    } catch (err) {
      setFund(null);
      setTransactions([]);
      setError(err instanceof ApiError ? err.message : "Could not load that fund.");
    }
  }

  async function handleRequestDisbursement(e: React.FormEvent) {
    e.preventDefault();
    if (!fundId) {
      setError("Load a fund first (above) before requesting a disbursement against it.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setPrediction(null);
    try {
      const result = await requestDisbursement(fundId, {
        disbursementId,
        amountLkr: Number(amountLkr),
        category,
        beneficiaryCount: Number(beneficiaryCount),
        organizationType,
      });
      setPrediction(result);
      setNotice(`Disbursement ${disbursementId} submitted for approval.`);
      setDisbursementId("");
      setAmountLkr("");
      setCategory(SECTORS[0]);
      setBeneficiaryCount("");
      await loadFund(fundId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit the disbursement request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecordOutcome(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingOutcome(true);
    setError(null);
    try {
      await recordOutcome(outcomeDisbursementId, outcomeReport, actualImpactLevel);
      setNotice(`Outcome recorded for disbursement ${outcomeDisbursementId}.`);
      setOutcomeDisbursementId("");
      setOutcomeReport("");
      if (fundId) await loadFund(fundId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record the outcome.");
    } finally {
      setSubmittingOutcome(false);
    }
  }

  const approvedAwaitingOutcome = transactions.filter(
    (t: any) => t.docType === "DISBURSEMENT" && t.status === "APPROVED"
  );

  return (
    <AppShell requiredRole="FundManager" navItems={NAV_ITEMS}>
      {() => (
        <>
          {notice && (
            <div className="banner-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}
          {error && (
            <div className="banner-error">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Card id="open-fund" title="Open a Fund" icon={<FolderOpen className="h-[18px] w-[18px]" />}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadFund(fundId);
              }}
              className="flex gap-3"
            >
              <input
                className="input-field flex-1"
                placeholder="Fund ID"
                value={fundId}
                onChange={(e) => setFundId(e.target.value)}
              />
              <button type="submit" className="btn-secondary">
                Load
              </button>
            </form>
            <p className="mt-2 text-[11px] text-slate-400">
              Format: e.g. <span className="font-mono">fund-real-1</span> — lowercase letters, numbers and hyphens,
              matching the Fund ID shown when the fund was created.
            </p>
          </Card>

          {fund && (
            <Card title={fund.name} description={fund.fundId} icon={<Wallet className="h-[18px] w-[18px]" />}>
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-slate-500">Status</p>
                  <p className="font-medium">{fund.status}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total contributed</p>
                  <p className="font-medium">LKR {fund.totalContributedLkr.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total disbursed</p>
                  <p className="font-medium">LKR {fund.totalDisbursedLkr.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-500">Available balance</p>
                  <p className="font-medium">
                    LKR {(fund.totalContributedLkr - fund.totalDisbursedLkr).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card
            id="request-disbursement"
            title="Request a Disbursement"
            description="FR2 / FR7 — the ML model predicts an impact level before this reaches Admin approval"
            icon={<HandCoins className="h-[18px] w-[18px]" />}
          >
            <form onSubmit={handleRequestDisbursement} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <input
                  className="input-field"
                  placeholder="Disbursement ID"
                  value={disbursementId}
                  onChange={(e) => setDisbursementId(e.target.value)}
                  required
                />
                <p className="text-[11px] text-slate-400">e.g. disb-ui-1 — any short unique ID you choose</p>
              </div>
              <div className="flex flex-col gap-1">
                <input
                  className="input-field"
                  placeholder="Amount (LKR)"
                  type="number"
                  min="0"
                  value={amountLkr}
                  onChange={(e) => setAmountLkr(e.target.value)}
                  required
                />
                <p className="text-[11px] text-slate-400">Numbers only, e.g. 5000</p>
              </div>
              <select
                className="input-field"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                {SECTORS.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
              <div className="flex flex-col gap-1">
                <input
                  className="input-field"
                  placeholder="Beneficiary count"
                  type="number"
                  min="0"
                  value={beneficiaryCount}
                  onChange={(e) => setBeneficiaryCount(e.target.value)}
                  required
                />
                <p className="text-[11px] text-slate-400">Whole number, e.g. 20</p>
              </div>
              <select
                className="input-field"
                value={organizationType}
                onChange={(e) => setOrganizationType(e.target.value as OrganizationType)}
              >
                {ORGANIZATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Submitting…" : "Submit request"}
              </button>
            </form>

            {prediction && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-medium text-slate-700">
                  Prediction for {prediction.disbursementId} — model comparison
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Object.entries(prediction.modelComparison ?? {}).map(([modelName, result]) => {
                    const isSelected = modelName === prediction.selectedModel;
                    return (
                      <div
                        key={modelName}
                        className={`rounded-xl border p-3 ${
                          isSelected ? "border-navy bg-white shadow-sm" : "border-slate-200 bg-white/60"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">{modelName}</span>
                          {isSelected && (
                            <span className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                              Deployed
                            </span>
                          )}
                        </div>
                        <div className="mb-1 flex items-center gap-2">
                          <ImpactBadge level={result.predicted_impact_level} />
                        </div>
                        <div className="text-xs text-slate-500">
                          {Object.entries(result.class_probabilities)
                            .map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`)
                            .join(" · ")}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Random Forest is the model actually recorded on the ledger for this disbursement — it was
                  selected over XGBoost by cross-validated accuracy. XGBoost is shown alongside it only for the
                  comparison the methodology commits to reporting.
                </p>
              </div>
            )}
          </Card>

          <Card
            id="outcome-reports"
            title="Record an Outcome Report"
            description="FR3 — close the loop once an approved disbursement has taken place"
            icon={<ClipboardCheck className="h-[18px] w-[18px]" />}
          >
            <form onSubmit={handleRecordOutcome} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1 sm:col-span-1">
                <input
                  className="input-field"
                  placeholder="Disbursement ID (approved)"
                  value={outcomeDisbursementId}
                  onChange={(e) => setOutcomeDisbursementId(e.target.value)}
                  required
                />
                <p className="text-[11px] text-slate-400">
                  e.g. disb-ui-1 — must match an approved disbursement ID (see the list below)
                </p>
              </div>
              <div className="flex flex-col gap-1 sm:col-span-1">
                <input
                  className="input-field"
                  placeholder="Outcome report (free text)"
                  value={outcomeReport}
                  onChange={(e) => setOutcomeReport(e.target.value)}
                  required
                />
                <p className="text-[11px] text-slate-400">
                  Short description, e.g. &quot;40 beneficiaries received medical aid&quot;
                </p>
              </div>
              <select
                className="input-field"
                value={actualImpactLevel}
                onChange={(e) => setActualImpactLevel(e.target.value as "Low" | "Medium" | "High")}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <button type="submit" disabled={submittingOutcome} className="btn-secondary sm:col-span-3 sm:w-fit">
                {submittingOutcome ? "Recording…" : "Record outcome"}
              </button>
            </form>
            {fund && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium text-slate-500">Approved disbursements awaiting an outcome report:</p>
                {approvedAwaitingOutcome.length === 0 && (
                  <p className="text-sm text-slate-400">None right now for this fund.</p>
                )}
                <ul className="space-y-1.5 text-sm">
                  {approvedAwaitingOutcome.map((d: any) => (
                    <li key={d.disbursementId} className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{d.disbursementId}</span>
                      <span>LKR {Number(d.amountLkr).toLocaleString()}</span>
                      <ImpactBadge level={d.predictedImpactLevel} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {fund && (
            <Card id="ledger" title="Transaction Ledger for This Fund" icon={<Receipt className="h-[18px] w-[18px]" />}>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">ID</th>
                      <th className="px-4 py-3 font-medium">Amount (LKR)</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t: any) => (
                      <tr key={t.contributionId ?? t.disbursementId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-slate-600">{t.docType}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.contributionId ?? t.disbursementId}</td>
                        <td className="px-4 py-3 text-slate-600">{Number(t.amountLkr).toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-600">{t.status ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}
