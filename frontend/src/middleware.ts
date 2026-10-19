import { jwtDecode } from "jwt-decode";
import { NextRequest, NextResponse } from "next/server";

/**
 * UX-level route guard only: redirects an unauthenticated visitor to
 * /login and sends a logged-in user away from a dashboard that doesn't
 * match their role. This decodes the JWT's payload without verifying its
 * signature (fine for routing), and is not a security boundary - every
 * route this guards still calls the backend, which independently
 * verifies the token and enforces role access on every request (see
 * backend/src/middleware/auth.ts). A bypass here can, at worst, show
 * someone a page whose data calls then correctly fail with a 403.
 */

const ROLE_PATH_PREFIX: Record<string, string> = {
  Admin: "/admin",
  FundManager: "/fund-manager",
  Donor: "/donor",
};

export function middleware(req: NextRequest) {
  const token = req.cookies.get("bf_token")?.value;
  const { pathname } = req.nextUrl;

  const guardedPrefixes = Object.values(ROLE_PATH_PREFIX);
  const isGuarded = guardedPrefixes.some((p) => pathname.startsWith(p));
  if (!isGuarded) return NextResponse.next();

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const decoded = jwtDecode<{ role: string; exp: number }>(token);
    if (decoded.exp * 1000 < Date.now()) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    const expectedPrefix = ROLE_PATH_PREFIX[decoded.role];
    if (!expectedPrefix || !pathname.startsWith(expectedPrefix)) {
      return NextResponse.redirect(new URL(expectedPrefix ?? "/login", req.url));
    }
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/fund-manager/:path*", "/donor/:path*"],
};
