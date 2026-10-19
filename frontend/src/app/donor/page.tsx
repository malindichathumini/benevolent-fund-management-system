"use client";

import {
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  HandCoins,
  HeartHandshake,
  History,
  PiggyBank,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppShell from "@/components/AppShell";
import Card from "@/components/Card";
import ImpactBadge from "@/components/ImpactBadge";
import StatCard from "@/components/StatCard";
import {
  ApiError,
  contribute,
  DonorImpactSummary,
  Fund,
  getDonorImpact,
  getFund,
  getFundTransactions,
  LedgerEntry,
} from "@/lib/api";

const IMPACT_COLORS: Record<string, string> = {
  High: "#16a34a",
  Medium: "#d97706",
  Low: "#dc2626",
};

const NAV_ITEMS = [
  { label: "Your Impact", href: "#impact", icon: <TrendingUp className="h-[18px] w-[18px]" /> },
  { label: "Open Fund", href: "#open-fund", icon: <FolderOpen className="h-[18px] w-[18px]" /> },
  { label: "Contribute", href: "#contribute", icon: <HandCoins className="h-[18px] w-[18px]" /> },
  { label: "Giving History", href: "#history", icon: <History className="h-[18px] w-[18px]" /> },
];

export default function DonorPage() {
  const [fundId, setFundId] = useState("");
  const [fund, setFund] = useState<Fund | null>(null);
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mySub, setMySub] = useState<string | null>(null);

  // Contribution form
  const [contributionId, setContributionId] = useState("");
  const [amountLkr, setAmountLkr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Cross-fund impact dashboard (Objective 3 / FR5): a donor's running
  // total across EVERY fund they've given to, not just the one fund
  // loaded below. Loaded on mount and refreshed right after a
  // contribution, so it reflects the ledger in real time.
  const [impact, setImpact] = useState<DonorImpactSummary | null>(null);
  const [impactLoading, setImpactLoading] = useState(true);
  const [impactError, setImpactError] = useState<string | null>(null);

  const loadImpact = useCallback(async () => {
    setImpactLoading(true);
    try {
      const summary = await getDonorImpact();
      setImpact(summary);
      setImpactError(null);
    } catch (err) {
      setImpactError(err instanceof ApiError ? err.message : "Could not load your impact summary.");
    } finally {
      setImpactLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImpact();
  }, [loadImpact]);

  async function loadFund(id: string, sub: string) {
    setError(null);
    try {
      const [f, txs] = await Promise.all([getFund(id), getFundTransactions(id)]);
      setFund(f);
      setTransactions(txs);
      setFundId(id);
      setMySub(sub);
    } catch (err) {
      setFund(null);
      setTransactions([]);
      setError(err instanceof ApiError ? err.message : "Could not load that fund.");
    }
  }

  async function handleContribute(e: React.FormEvent, sub: string) {
    e.preventDefault();
    if (!fundId) {
      setError("Load a fund first (above) before contributing to it.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await contribute(fundId, contributionId, Number(amountLkr));
      setNotice(`Contribution ${contributionId} recorded. Thank you!`);
      setContributionId("");
      setAmountLkr("");
      await Promise.all([loadFund(fundId, sub), loadImpact()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record the contribution.");
    } finally {
      setSubmitting(false);
    }
  }

  const myContributions = useMemo(
    () => transactions.filter((t: any) => t.docType === "CONTRIBUTION" && t.donorId === mySub),
    [transactions, mySub]
  );

  const disbursements = useMemo(
    () => transactions.filter((t: any) => t.docType === "DISBURSEMENT"),
    [transactions]
  );

  // Objective 3 / Section 4.5.2: real-time donor impact visibility.
  const cumulativeContributions = useMemo(() => {
    const sorted = [...myContributions].sort(
      (a: any, b: any) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    let running = 0;
    return sorted.map((c: any) => {
      running += Number(c.amountLkr);
      return { label: c.contributionId, cumulativeLkr: running };
    });
  }, [myContributions]);

  const disbursementsByCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const d of disbursements as any[]) {
      totals.set(d.category, (totals.get(d.category) ?? 0) + Number(d.amountLkr));
    }
    return Array.from(totals.entries()).map(([category, amountLkr]) => ({ category, amountLkr }));
  }, [disbursements]);

  const impactDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of disbursements as any[]) {
      counts.set(d.predictedImpactLevel, (counts.get(d.predictedImpactLevel) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([level, count]) => ({ level, count }));
  }, [disbursements]);

  return (
    <AppShell requiredRole="Donor" navItems={NAV_ITEMS}>
      {(session) => (
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

          <div id="impact">
            {impact && impact.totalDonations > 0 && (
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total donated"
                  value={`LKR ${impact.totalDonatedLkr.toLocaleString()}`}
                  icon={<Wallet className="h-5 w-5" />}
                  accent="navy"
                />
                <StatCard
                  label="Donations made"
                  value={impact.totalDonations}
                  icon={<PiggyBank className="h-5 w-5" />}
                  accent="maroon"
                />
                <StatCard
                  label="Funds supported"
                  value={impact.fundsSupported}
                  icon={<HeartHandshake className="h-5 w-5" />}
                  accent="emerald"
                />
                <StatCard
                  label="Beneficiaries reached"
                  value={impact.totalBeneficiariesReached.toLocaleString()}
                  icon={<Users className="h-5 w-5" />}
                  accent="amber"
                />
              </div>
            )}

            <Card
              title="Your Impact, Across All Funds"
              description="Real-time donor impact visibility (FR5)"
              icon={<TrendingUp className="h-[18px] w-[18px]" />}
            >
              {impactError && <p className="mb-3 text-sm text-red-700">{impactError}</p>}
              {impactLoading && !impact ? (
                <p className="text-sm text-slate-500">Loading your cumulative impact…</p>
              ) : impact && impact.totalDonations === 0 ? (
                <p className="text-sm text-slate-500">
                  You haven&apos;t made a contribution yet. Load a fund below and contribute to see your running
                  total here, updated live from the ledger.
                </p>
              ) : impact && (impact.impactLevelMix.Low + impact.impactLevelMix.Medium + impact.impactLevelMix.High) > 0 ? (
                <div className="flex flex-col items-center gap-6 sm:flex-row">
                  <div style={{ width: 180, height: 180 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={(["Low", "Medium", "High"] as const)
                            .map((level) => ({ level, count: impact.impactLevelMix[level] }))
                            .filter((d) => d.count > 0)}
                          dataKey="count"
                          nameKey="level"
                          outerRadius={75}
                          label
                        >
                          {(["Low", "Medium", "High"] as const)
                            .filter((level) => impact.impactLevelMix[level] > 0)
                            .map((level) => (
                              <Cell key={level} fill={IMPACT_COLORS[level] ?? "#94a3b8"} />
                            ))}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1">
                    <p className="mb-2 text-sm font-medium text-slate-700">
                      Impact mix of the disbursements your supported funds have made
                    </p>
                    <ul className="space-y-1 text-sm">
                      {impact.funds.map((f) => (
                        <li key={f.fundId} className="flex justify-between border-b border-slate-100 py-1.5">
                          <span>
                            {f.fundName} <span className="text-xs text-slate-400">({f.fundId})</span>
                          </span>
                          <span className="text-slate-600">LKR {f.myTotalDonatedLkr.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-slate-500">
                      Beneficiary counts and impact levels are the supported fund&apos;s own totals, not
                      individually earmarked per donation (the ledger links contributions and disbursements at
                      the fund level, not to each other directly).
                    </p>
                  </div>
                </div>
              ) : null}
            </Card>
          </div>

          <Card id="open-fund" title="Open a Fund" icon={<FolderOpen className="h-[18px] w-[18px]" />}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadFund(fundId, session.sub);
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
          </Card>

          {fund && (
            <Card title={fund.name} description={fund.fundId} icon={<Wallet className="h-[18px] w-[18px]" />}>
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-slate-500">Status</p>
                  <p className="font-medium">{fund.status}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total contributed (all donors)</p>
                  <p className="font-medium">LKR {fund.totalContributedLkr.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total disbursed</p>
                  <p className="font-medium">LKR {fund.totalDisbursedLkr.toLocaleString()}</p>
                </div>
              </div>
            </Card>
          )}

          <Card
            id="contribute"
            title="Make a Contribution"
            description="FR4 — contribute to the fund you just opened"
            icon={<HandCoins className="h-[18px] w-[18px]" />}
          >
            <form onSubmit={(e) => handleContribute(e, session.sub)} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                className="input-field"
                placeholder="Contribution ID"
                value={contributionId}
                onChange={(e) => setContributionId(e.target.value)}
                required
              />
              <input
                className="input-field"
                placeholder="Amount (LKR)"
                type="number"
                min="0"
                value={amountLkr}
                onChange={(e) => setAmountLkr(e.target.value)}
                required
              />
              <button type="submit" disabled={submitting} className="btn-accent">
                {submitting ? "Submitting…" : "Contribute"}
              </button>
            </form>
            <p className="mt-3 text-xs text-slate-500">
              Recorded on the ledger with your donor ID attached, so it shows up below as &quot;your
              contributions&quot; even though every Donor shares one Fabric identity on the backend (role-based
              identity; individual attribution is kept at the application layer via the JWT claim — see the
              backend README).
            </p>
          </Card>

          {fund && (
            <>
              <Card id="history" title="Your Contribution History" icon={<History className="h-[18px] w-[18px]" />}>
                {myContributions.length === 0 && (
                  <p className="text-sm text-slate-500">No contributions recorded yet for this fund.</p>
                )}
                <ul className="space-y-1.5 text-sm">
                  {myContributions.map((c: any) => (
                    <li key={c.contributionId} className="flex items-center justify-between border-b border-slate-100 py-1.5">
                      <span className="font-mono text-xs text-slate-500">{c.contributionId}</span>
                      <span className="font-medium text-slate-700">LKR {Number(c.amountLkr).toLocaleString()}</span>
                      <span className="text-xs text-slate-400">{new Date(c.recordedAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title="Your Cumulative Giving" description="Real-time donor impact view">
                {cumulativeContributions.length === 0 ? (
                  <p className="text-sm text-slate-500">Contribute above to see your giving grow here.</p>
                ) : (
                  <div style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer>
                      <LineChart data={cumulativeContributions}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => `LKR ${v.toLocaleString()}`} />
                        <Line type="monotone" dataKey="cumulativeLkr" stroke="#1F4E78" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              <Card title="Where This Fund's Money Went, by Category">
                {disbursementsByCategory.length === 0 ? (
                  <p className="text-sm text-slate-500">No disbursements recorded yet for this fund.</p>
                ) : (
                  <div style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart data={disbursementsByCategory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => `LKR ${v.toLocaleString()}`} />
                        <Bar dataKey="amountLkr" fill="#A6342D" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              <Card title="Predicted Impact Mix of Disbursements">
                {impactDistribution.length === 0 ? (
                  <p className="text-sm text-slate-500">No disbursements recorded yet for this fund.</p>
                ) : (
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    <div style={{ width: 220, height: 220 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={impactDistribution} dataKey="count" nameKey="level" outerRadius={90} label>
                            {impactDistribution.map((entry) => (
                              <Cell key={entry.level} fill={IMPACT_COLORS[entry.level] ?? "#94a3b8"} />
                            ))}
                          </Pie>
                          <Legend />
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {impactDistribution.map((entry) => (
                        <div key={entry.level} className="flex items-center gap-2 text-sm">
                          <ImpactBadge level={entry.level} />
                          <span className="text-slate-500">× {entry.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-3 text-xs text-slate-500">
                  Shown here as the model&apos;s <em>predicted</em> impact level at request time (Section 4.6). The
                  model currently reaches 70.3% cross-validated accuracy on the available dataset, below the
                  project&apos;s 85% target, so these figures are presented as an interim, improving indicator
                  rather than a guarantee (Thesis Section 5.10).
                </p>
              </Card>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
