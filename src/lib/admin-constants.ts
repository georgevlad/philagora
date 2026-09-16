/** Shared admin auth constants — safe for both Node and Edge runtimes. */

export const ADMIN_COOKIE_NAME = "philagora_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours
export const HMAC_PAYLOAD = "philagora-admin-session";

/** Passwordless admin access is a local development convenience only. */
export function isAdminOpen(): boolean {
  return !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== "production";
}
