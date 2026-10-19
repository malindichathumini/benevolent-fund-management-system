"use client";

import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getSession, Role, SessionClaims } from "@/lib/auth";
import Sidebar, { NavItem } from "./Sidebar";

const ROLE_LABEL: Record<Role, string> = {
  Admin: "Administrator",
  FundManager: "Fund Manager",
  Donor: "Donor",
};

export default function AppShell({
  requiredRole,
  navItems,
  children,
}: {
  requiredRole: Role;
  navItems?: NavItem[];
  children: (session: SessionClaims) => React.ReactNode;
}) {
  const router = useRouter();
  const [session, setSession] = useState<SessionClaims | null | undefined>(undefined);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== requiredRole) {
      router.replace("/login");
      return;
    }
    setSession(s);
  }, [requiredRole, router]);

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading…
      </div>
    );
  }
  if (!session) return null;

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        role={requiredRole}
        session={session}
        navItems={navItems}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={handleLogout}
      />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3.5 backdrop-blur lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Benevolent Fund Platform</p>
            <h1 className="text-lg font-semibold text-slate-900">{ROLE_LABEL[requiredRole]} Dashboard</h1>
          </div>
        </header>
        <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 lg:px-8">{children(session)}</main>
      </div>
    </div>
  );
}
