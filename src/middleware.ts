import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware protects /admin/* routes (pages AND API) with a password gate.
 *
 * Uses Web Crypto (Edge-compatible) to verify the session cookie.
 * If ADMIN_PASSWORD is not set, admin is open (local-dev convenience).
 */

const COOKIE_NAME = "philagora_admin";
const HMAC_PAYLOAD = "philagora-admin-session";

// ── Edge-compatible HMAC ────────────────────────────────────────────

async function deriveToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(HMAC_PAYLOAD));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ── Middleware ───────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip login page and auth API — they must be accessible without a session
  if (
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/auth")
  ) {
    return NextResponse.next();
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  // No password configured → admin is open
  if (!adminPassword) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;

  if (cookie) {
    const expected = await deriveToken(adminPassword);
    if (constantTimeEqual(cookie, expected)) {
      return NextResponse.next();
    }
  }

  // Not authenticated — redirect pages, 401 for API
  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  return NextResponse.redirect(loginUrl);
}

// Only run on admin routes
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
