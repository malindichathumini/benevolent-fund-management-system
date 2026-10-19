const STYLES: Record<string, string> = {
  High: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Medium: "bg-amber-50 text-amber-700 ring-amber-600/20",
  Low: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const DOT: Record<string, string> = {
  High: "bg-emerald-500",
  Medium: "bg-amber-500",
  Low: "bg-rose-500",
};

export default function ImpactBadge({ level }: { level: string }) {
  const style = STYLES[level] ?? "bg-slate-100 text-slate-600 ring-slate-500/10";
  const dot = DOT[level] ?? "bg-slate-400";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {level} impact
    </span>
  );
}
