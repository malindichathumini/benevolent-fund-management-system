"use client";

import { AlertCircle, Banknote, CheckCircle2, FolderOpen, ListTree, PlusCircle, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import StatCard from "@/components/StatCard";
import { ApiError, createFund, Fund, listFunds } from "@/lib/api";

const NAV_ITEMS = [
  { label: "Create Fund", href: "#create-fund", icon: <PlusCircle className="h-[18px] w-[18px]" /> },
  { label: "Fund Directory", href: "#fund-directory", icon: <ListTree className="h-[18px] w-[18px]" /> },
];

export default function AdminPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Create-fund form
  const [newFundId, setNewFundId] = useState("");
  const [newFundName, setNewFundName] = useState("");
  const [newOrgId, setNewOrgId] = useState("");
  const [creating, setCreating] = useState(false);

  // Jump straight to a fund by ID, without scrolling the directory table
  const [jumpFundId, setJumpFundId] = useState("");

  // Fund directory - every record lives in this table; opening one
  // navigates to its own page (/admin/funds/<fundId>) rather than
  // loading inline here.
  const [allFunds, setAllFunds] = useState<Fund[] | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const loadDirectory = useCallback(async () => {
    try {
      const funds = await listFunds();
      setAllFunds(funds);
      setDirectoryError(null);
    } catch (err) {
      setDirectoryError(err instanceof ApiError ? err.message : "Could not load the fund directory.");
    }
  }, []);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  function openFund(id: string) {
    router.push(`/admin/funds/${encodeURIComponent(id)}`);
  }

  async function handleCreateFund(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await createFund(newFundId, newFundName, newOrgId);
      const createdId = newFundId;
      setNewFundId("");
      setNewFundName("");
      setNewOrgId("");
      await loadDirectory();
      openFund(createdId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the fund.");
    } finally {
      setCreating(false);
    }
  }

  const totalFunds = allFunds?.length ?? 0;
  const openFunds = allFunds?.filter((f) => f.status === "OPEN").length ?? 0;
  const totalContributed = allFunds?.reduce((sum, f) => sum + f.totalContributedLkr, 0) ?? 0;
  const totalDisbursed = allFunds?.reduce((sum, f) => sum + f.totalDisbursedLkr, 0) ?? 0;

  return (
    <AppShell requiredRole="Admin" navItems={NAV_ITEMS}>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total funds" value={totalFunds} icon={<FolderOpen className="h-5 w-5" />} accent="navy" />
            <StatCard label="Open funds" value={openFunds} icon={<CheckCircle2 className="h-5 w-5" />} accent="emerald" />
            <StatCard
              label="Total contributed"
              value={`LKR ${totalContributed.toLocaleString()}`}
              icon={<Wallet className="h-5 w-5" />}
              accent="maroon"
            />
            <StatCard
              label="Total disbursed"
              value={`LKR ${totalDisbursed.toLocaleString()}`}
              icon={<Banknote className="h-5 w-5" />}
              accent="amber"
            />
          </div>

          <Card
            id="create-fund"
            title="Create a Fund"
            description="FR1 — set up a new charitable fund for an organization"
            icon={<PlusCircle className="h-[18px] w-[18px]" />}
          >
            <form onSubmit={handleCreateFund} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <input
                className="input-field"
                placeholder="Fund ID (e.g. fund-flood-2026)"
                value={newFundId}
                onChange={(e) => setNewFundId(e.target.value)}
                required
              />
              <input
                className="input-field"
                placeholder="Fund name"
                value={newFundName}
                onChange={(e) => setNewFundName(e.target.value)}
                required
              />
              <input
                className="input-field"
                placeholder="Organization ID"
                value={newOrgId}
                onChange={(e) => setNewOrgId(e.target.value)}
                required
              />
              <button type="submit" disabled={creating} className="btn-primary">
                {creating ? "Creating…" : "Create fund"}
              </button>
            </form>
          </Card>

          <Card
            id="fund-directory"
            title="Fund Directory"
            description="Every fund on the ledger — click a record to open its full details"
            icon={<ListTree className="h-[18px] w-[18px]" />}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (jumpFundId) openFund(jumpFundId);
              }}
              className="mb-5 flex gap-3"
            >
              <input
                className="input-field flex-1"
                placeholder="Or jump straight to a fund ID…"
                value={jumpFundId}
                onChange={(e) => setJumpFundId(e.target.value)}
              />
              <button type="submit" className="btn-secondary">
                Open
              </button>
            </form>

            {directoryError && <p className="mb-3 text-sm text-red-700">{directoryError}</p>}
            {allFunds === null && !directoryError && <p className="text-sm text-slate-500">Loading funds…</p>}
            {allFunds !== null && allFunds.length === 0 && (
              <p className="text-sm text-slate-500">No funds created yet — use the form above.</p>
            )}
            {allFunds !== null && allFunds.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-medium">Fund</th>
                      <th className="px-4 py-3 font-medium">Organization</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Contributed (LKR)</th>
                      <th className="px-4 py-3 font-medium">Disbursed (LKR)</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {allFunds.map((f) => (
                      <tr
                        key={f.fundId}
                        onClick={() => openFund(f.fundId)}
                        className="cursor-pointer border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{f.name}</p>
                          <p className="text-xs text-slate-400">{f.fundId}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{f.organizationId}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                              f.status === "OPEN" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {f.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{f.totalContributedLkr.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-600">{f.totalDisbursedLkr.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openFund(f.fundId);
                            }}
                            className="btn-secondary px-3 py-1.5 text-xs"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </AppShell>
  );
}
