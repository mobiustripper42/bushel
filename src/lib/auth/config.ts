/**
 * Session config shared by the cookie glue (session-cookie.ts) and the
 * middleware (proxy.ts). Kept free of `next/headers` so the middleware — which
 * runs before the request-scope those APIs need — can import it.
 */

export const ADMIN_SESSION_COOKIE = "bbf_admin_session";
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const RENEW_WITHIN_MS = 3 * 24 * 60 * 60 * 1000; // re-issue inside the last 3 days

/**
 * The HMAC signing key. Prod MUST set SESSION_SECRET — an unset secret in
 * production would degrade to a repo-public key, letting anyone forge a session.
 * Fail fast there. Dev/test use an obvious insecure default for zero-config work
 * (CI sets a fixed value so the app and global-setup mint with the same key).
 * Resolved lazily (per call, not at module load) so `next build` — which
 * evaluates modules in production mode without the env set — doesn't trip it.
 */
export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return "dev-insecure-session-secret";
}
