import { ReactNode } from "react";

export default function Card({
  id,
  title,
  description,
  icon,
  actions,
  children,
  className = "",
}: {
  id?: string;
  title?: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      id={id}
      className={`scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ${className}`}
    >
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy">
                {icon}
              </span>
            )}
            <div>
              {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
