"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import { ApiError, login } from "@/lib/api";
import { dashboardPathForRole, Role, saveSession } from "@/lib/auth";

const DEMO_ACCOUNTS = [
  { label: "Admin", username: "admin", password: "Admin@123" },
  { label: "Fund Manager", username: "fundmanager", password: "FundMgr@123" },
  { label: "Donor", username: "donor1", password: "Donor@123" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { token, role } = await login(username, password);
      saveSession(token);
      router.push(dashboardPathForRole(role as Role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the backend. Is it running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue to your dashboard">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Username</label>
          <input
            className="input-field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="banner-error">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        New donor?{" "}
        <Link href="/register" className="font-medium text-navy hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-2.5 text-xs font-medium text-slate-500">Quick sign-in (demo accounts)</p>
        <div className="flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.username}
              type="button"
              onClick={() => {
                setUsername(acc.username);
                setPassword(acc.password);
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-navy hover:text-navy"
            >
              {acc.label}
            </button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}
