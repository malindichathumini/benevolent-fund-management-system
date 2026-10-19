"use client";

import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

export type Role = "Admin" | "FundManager" | "Donor";

export interface SessionClaims {
  sub: string;
  role: Role;
  name: string;
  exp: number;
}

const TOKEN_COOKIE = "bf_token";

export function saveSession(token: string): void {
  // 8h expiry mirrors the backend's JWT lifetime (src/middleware/auth.ts signToken).
  Cookies.set(TOKEN_COOKIE, token, { expires: 1 / 3, sameSite: "lax" });
}

export function clearSession(): void {
  Cookies.remove(TOKEN_COOKIE);
}

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_COOKIE);
}

export function getSession(): SessionClaims | null {
  const token = getToken();
  if (!token) return null;
  try {
    const decoded = jwtDecode<SessionClaims>(token);
    if (decoded.exp * 1000 < Date.now()) {
      clearSession();
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function dashboardPathForRole(role: Role): string {
  switch (role) {
    case "Admin":
      return "/admin";
    case "FundManager":
      return "/fund-manager";
    case "Donor":
      return "/donor";
  }
}
