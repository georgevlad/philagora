/**
 * Unified authentication module.
 *
 * Provides a single entry point for determining who is making a request.
 * Currently supports admin sessions; designed to extend to user sessions.
 *
 * Usage in API routes:
 *   const denied = requireAdmin(request);
 *   if (denied) return denied;
 *
 * Usage in server components:
 *   const identity = await getIdentityFromCookies();
 *   if (identity.type !== "admin") { ... }
 *
 * Note: Edge middleware (src/middleware.ts) has its own auth check using
 * Web Crypto and is intentionally NOT part of this module. This module
 * handles Node-runtime auth for API route handlers and server components.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-auth";

// ── Identity Types ─────────────────────────────────────────────

export type RequestIdentity =
  | { type: "admin" }
  | { type: "user"; id: string; email: string }
  | { type: "anonymous" };

// ── Identity Resolvers ─────────────────────────────────────────

/**
 * Resolve identity from a NextRequest (API route handlers).
 * Checks admin cookie first; user session will be added here later.
 */
export function getIdentityFromRequest(request: NextRequest): RequestIdentity {
  const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (verifyAdminToken(adminToken)) {
    return { type: "admin" };
  }

  // Future: check user session cookie here
  // const userSession = request.cookies.get(USER_COOKIE_NAME)?.value;
  // if (userSession) { ... resolve user from DB ... return { type: "user", id, email }; }

  return { type: "anonymous" };
}

/**
 * Resolve identity from the cookie store (server components).
 * Uses Next.js `cookies()` API - must be called from a server component or
 * server action context.
 */
export async function getIdentityFromCookies(): Promise<RequestIdentity> {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (verifyAdminToken(adminToken)) {
    return { type: "admin" };
  }

  // Future: check user session cookie here

  return { type: "anonymous" };
}

// ── Guard Helpers ──────────────────────────────────────────────

/**
 * Guard for admin-only API routes.
 * Returns a 401 NextResponse if the request is not from an admin,
 * or null if the request is authorized.
 */
export function requireAdmin(request: NextRequest): NextResponse | null {
  const identity = getIdentityFromRequest(request);
  if (identity.type === "admin") return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// ── Predicate Helpers ──────────────────────────────────────────

export function isAdmin(identity: RequestIdentity): identity is { type: "admin" } {
  return identity.type === "admin";
}

export function isAuthenticated(
  identity: RequestIdentity
): identity is { type: "admin" } | { type: "user"; id: string; email: string } {
  return identity.type !== "anonymous";
}
