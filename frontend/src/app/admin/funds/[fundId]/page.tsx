"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, Receipt, Wallet2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import ImpactBadge from "@/components/ImpactBadge";
import {
  approveDisbursement,
  ApiError,
  closeFund,
  Fund,
  getFund,
  getFundTransactions,
  LedgerEntry,
  rejectDisbursement,
} from "@/lib/api";

const NAV_ITEMS = [
  { label: "Approvals", href: "#approvals", icon: <CheckCircle2 className="h-[18px] w-[18px]" /> },
  { label: "Ledger", href: "#ledger", icon: <Receipt className="h-[18px] w-[18px]" /> },
];

/**
 * Dedicated detail page for one fund record (/admin/funds/<fundId>),
 * replacing the old pattern of loading a fund inline on the Admin
 * dashboard. Clicking a row in the Fund Directory (admin/page.tsx)
 * navigates here instead.
 */
export default function AdminFundDetailPage({ params }: { params: { fundId: string } }) {
  const { fundId } = params;
  const [fund, setFund] = useState<Fund | null>(null);
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [f, txs] = await Promise.all([getFund(fundId), getFundTransactions(fundId)]);
      setFund(f);
      setTransactions(txs);
    } catch (err) {
      setFund(null);
      setTransactions([]);
      setError(err instanceof ApiError ? err.message : "Could not load that fund.");
    } finally {
      setLoading(false);
    }
  }, [fundId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCloseFund() {
    if (!fund) return;
    if (!window.confirm(`Close fund ${fund.fundId}? It will no longer accept contributions.`)) return;
    setClosing(true);
    setError(null);
    try {
      await closeFund(fund.fundId);
      setNotice(`Fund ${fund.fundId} closed.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not close the fund.");
    } finally {
      setClosing(false);
    }
  }

  async function handleApprove(disbursementId: string) {
    setError(null);
    try {
      await approveDisbursement(disbursementId);
      setNotice(`Disbursement ${disbursementId} approved.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not approve.");
    }
  }

  async function handleReject(disbursementId: string) {
    const reason = window.prompt("Reason for rejecting this disbursement?");
    if (!reason) return;
    setError(null);
    try {
      await rejectDisbursement(disbursementId, reason);
      setNotice(`Disbursement ${disbursementId} rejected.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reject.");
    }
  }

  const pendingDisbursements = transactions.filter(
    (t) => t.docType === "DISBURSEMENT" && (t as any).status === "PENDING_APPROVAL"
  );

  return (
    <AppShell requiredRole="Admin" navItems={NAV_ITEMS}>
      {() => (
        <>
          <Link
            href="/admin"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-navy"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Fund Directory
          </Link>

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

          {loading && <p className="text-sm text-slate-500">Loading fund…</p>}
          {!loading && !fund && !error && <p className="text-sm text-slate-500">Fund not found.</p>}

          {fund && (
            <Card title={fund.name} description={fund.fundId} icon={<Wallet2 className="h-[18px] w-[18px]" />}>
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-slate-500">Status</p>
                  <p className="font-medium">{fund.status}</p>
                </div>
                <div>
                  <p className="text-slate-500">Organization</p>
                  <p className="font-medium">{fund.organizationId}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total contributed</p>
                  <p className="font-medium">LKR {fund.totalContributedLkr.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total disbursed</p>
                  <p className="font-medium">LKR {fund.totalDisbursedLkr.toLocaleString()}</p>
                </div>
              </div>
              {fund.status === "OPEN" && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <button onClick={handleCloseFund} disabled={closing} className="btn-danger">
                    {closing ? "Closing…" : "Close fund"}
                  </button>
                  <p className="mt-2 text-xs text-slate-500">
                    Closing stops new contributions; already-approved disbursements are unaffected.
                  </p>
                </div>
              )}
            </Card>
          )}

          {fund && (
            <Card
              id="approvals"
              title="Disbursement Approval Queue"
              description="FR2 — review the ML model's predicted impact before deciding"
              icon={<CheckCircle2 className="h-[18px] w-[18px]" />}
            >
              {pendingDisbursements.length === 0 && <p className="text-sm text-slate-500">Nothing pending approval.</p>}
              <div className="space-y-3">
                {pendingDisbursements.map((d: any) => (
                  <div
                    key={d.disbursementId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {d.disbursementId} — LKR {Number(d.amountLkr).toLocaleString()} ({d.category})
                      </p>
                      <p className="text-xs text-slate-500">
                        {d.beneficiaryCount} beneficiaries · requested by {d.requestedBy}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <ImpactBadge level={d.predictedImpactLevel} />
                      <button
                        onClick={() => handleApprove(d.disbursementId)}
                        className="btn bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-400"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </button>
                      <button onClick={() => handleReject(d.disbursementId)} className="btn-danger">
                        <X className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {fund && (
            <Card
              id="ledger"
              title="Full Transaction Ledger"
              description="FR1 — the complete, immutable history for this fund"
              icon={<Receipt className="h-[18px] w-[18px]" />}
            >
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
                      <tr
                        key={t.contributionId ?? t.disbursementId}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-3 text-slate-600">{t.docType}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {t.contributionId ?? t.disbursementId}
                        </td>
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
