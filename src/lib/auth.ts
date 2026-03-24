/**
 * Unified authentication module.
 *
 * Provides a single entry point for determining who is making a request.
 * Supports admin sessions plus Better Auth user sessions.
 *
 * Usage in API routes:
 *   const denied = requireAdmin(request);
 *   if (denied) return denied;
 *
 *   const identity = await getIdentityFromHeaders(request);
 *   if (identity.type === "user") { ... }
 *
 * Usage in server components:
 *   const identity = await getIdentityFromCookies();
 *   if (identity.type !== "admin") { ... }
 *
 * Note: Edge middleware (src/middleware.ts) has its own auth check using
 * Web Crypto and is intentionally NOT part of this module. This module
 * handles Node-runtime auth for API route handlers and server components.
 */

import { cookies, headers as getHeaders } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-auth";
import { auth as betterAuthInstance, ensureBetterAuthTables } from "@/lib/better-auth";

export type RequestIdentity =
  | { type: "admin" }
  | { type: "user"; id: string; email: string }
  | { type: "anonymous" };

/**
 * Resolve identity from a NextRequest.
 * This stays synchronous so admin-only guards can keep their current API.
 */
export function getIdentityFromRequest(request: NextRequest): RequestIdentity {
  const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (verifyAdminToken(adminToken)) {
    return { type: "admin" };
  }

  return { type: "anonymous" };
}

/**
 * Resolve identity from request headers (async, for API routes that need
 * user-session awareness). Checks admin first, then Better Auth.
 */
export async function getIdentityFromHeaders(
  request: NextRequest
): Promise<RequestIdentity> {
  const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (verifyAdminToken(adminToken)) {
    return { type: "admin" };
  }

  try {
    await ensureBetterAuthTables();
    const session = await betterAuthInstance.api.getSession({
      headers: new Headers(request.headers),
    });

    if (session?.user) {
      return {
        type: "user",
        id: session.user.id,
        email: session.user.email,
      };
    }
  } catch {
    // Treat Better Auth lookup failures as anonymous requests.
  }

  return { type: "anonymous" };
}

/**
 * Resolve identity from the server component cookie/header context.
 * Checks admin first, then Better Auth.
 */
export async function getIdentityFromCookies(): Promise<RequestIdentity> {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (verifyAdminToken(adminToken)) {
    return { type: "admin" };
  }

  try {
    await ensureBetterAuthTables();
    const session = await betterAuthInstance.api.getSession({
      headers: new Headers(await getHeaders()),
    });

    if (session?.user) {
      return {
        type: "user",
        id: session.user.id,
        email: session.user.email,
      };
    }
  } catch {
    // Treat Better Auth lookup failures as anonymous requests.
  }

  return { type: "anonymous" };
}

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

export function isAdmin(identity: RequestIdentity): identity is { type: "admin" } {
  return identity.type === "admin";
}

export function isAuthenticated(
  identity: RequestIdentity
): identity is { type: "admin" } | { type: "user"; id: string; email: string } {
  return identity.type !== "anonymous";
}
