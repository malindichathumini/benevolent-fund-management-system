import { ReactNode } from "react";

const ACCENT_CLASSES: Record<string, string> = {
  navy: "bg-navy-50 text-navy",
  maroon: "bg-maroon-50 text-maroon",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  slate: "bg-slate-100 text-slate-600",
};

export default function StatCard({
  label,
  value,
  icon,
  accent = "navy",
  hint,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  accent?: "navy" | "maroon" | "emerald" | "amber" | "slate";
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3.5">
        {icon && (
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ACCENT_CLASSES[accent]}`}>
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500">{label}</p>
          <p className="truncate text-xl font-semibold text-slate-900">{value}</p>
          {hint && <p className="truncate text-xs text-slate-400">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
