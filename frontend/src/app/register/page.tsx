"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import { ApiError, register } from "@/lib/api";
import { dashboardPathForRole, Role, saveSession } from "@/lib/auth";

/** FR4 / use-case diagram: Donor "Register / Login (JWT)". */
export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const { token, role } = await register(username, password, displayName);
      saveSession(token);
      router.push(dashboardPathForRole(role as Role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the backend. Is it running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Create a donor account" subtitle="Register to contribute to funds and track your impact">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Your name</label>
          <input
            className="input-field"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            required
          />
        </div>
        <div>
          <label className="label">Username</label>
          <input
            className="input-field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            minLength={3}
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
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className="mt-1.5 text-xs text-slate-400">At least 8 characters.</p>
        </div>
        <div>
          <label className="label">Confirm password</label>
          <input
            type="password"
            className="input-field"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        {error && <p className="banner-error">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-navy hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
