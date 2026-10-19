"use client";

import { LogOut, X } from "lucide-react";
import { ReactNode } from "react";
import { Role, SessionClaims } from "@/lib/auth";

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

const ROLE_LABEL: Record<Role, string> = {
  Admin: "Administrator",
  FundManager: "Fund Manager",
  Donor: "Donor",
};

const ROLE_BADGE: Record<Role, string> = {
  Admin: "bg-navy-50 text-navy",
  FundManager: "bg-amber-50 text-amber-700",
  Donor: "bg-emerald-50 text-emerald-700",
};

export default function Sidebar({
  role,
  session,
  navItems = [],
  mobileOpen,
  onCloseMobile,
  onLogout,
}: {
  role: Role;
  session: SessionClaims;
  navItems?: NavItem[];
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}) {
  const initials =
    session.name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const body = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-sm font-bold text-white">
            BF
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">Benevolent Fund</p>
            <p className="text-xs text-slate-400">Platform</p>
          </div>
        </div>
        <button
          onClick={onCloseMobile}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <span className={`mx-5 mb-4 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_BADGE[role]}`}>
        {ROLE_LABEL[role]}
      </span>

      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            onClick={onCloseMobile}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <span className="text-slate-400">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-700">{session.name}</p>
            <p className="truncate text-xs text-slate-400">{ROLE_LABEL[role]}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        {body}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={onCloseMobile} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">{body}</aside>
        </div>
      )}
    </>
  );
}
