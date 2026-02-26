/**
 * Minimal admin authentication — password gate via signed cookie.
 *
 * How it works:
 *   1. ADMIN_PASSWORD env var holds the shared password.
 *   2. On login the password is verified and we set a cookie whose value is
 *      an HMAC-SHA256 of a fixed string keyed by the password.
 *   3. On every /admin request the middleware re-derives the HMAC and checks
 *      it matches the cookie value.
 *   4. If ADMIN_PASSWORD is not set, admin is open (local-dev convenience).
 */

import { createHmac } from "crypto";

export const ADMIN_COOKIE_NAME = "philagora_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

const HMAC_PAYLOAD = "philagora-admin-session";

// ── Helpers ──────────────────────────────────────────────────────────

/** Derive the expected cookie token from the current ADMIN_PASSWORD. */
function deriveToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return createHmac("sha256", pw).update(HMAC_PAYLOAD).digest("hex");
}

/** Returns true when no password is configured (open admin). */
export function isAdminOpen(): boolean {
  return !process.env.ADMIN_PASSWORD;
}

/** Check a raw password against the env var. */
export function verifyPassword(candidate: string): boolean {
  return candidate === process.env.ADMIN_PASSWORD;
}

/** Create the token value to store in the cookie. */
export function createAdminToken(): string {
  const t = deriveToken();
  if (!t) throw new Error("Cannot create token without ADMIN_PASSWORD");
  return t;
}

/** Verify a cookie value matches the current password-derived token. */
export function verifyAdminToken(cookieValue: string | undefined): boolean {
  if (isAdminOpen()) return true; // no password → always valid
  if (!cookieValue) return false;
  const expected = deriveToken();
  if (!expected) return false;
  // Constant-time compare
  if (cookieValue.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < cookieValue.length; i++) {
    mismatch |= cookieValue.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
