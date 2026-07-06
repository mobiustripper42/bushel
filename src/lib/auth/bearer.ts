/**
 * Bearer-token auth for the /api/mobile/* surface (Phase 11.1, DEC-047/050).
 * Native clients can't invoke Server Actions or read the httpOnly session cookie,
 * so the bushel-mobile app carries the SAME HMAC session token (DEC-047) in an
 * `Authorization: Bearer <token>` header. This verifies it with the exact
 * framework-free verifier the cookie path uses (verifySession) — no second trust
 * root, no new session table. A route with a null subject returns 401.
 */
import { sessionSecret } from "./config";
import { verifySession, type Subject } from "./session";

/** The subject behind a request's bearer token, or null if absent/malformed/invalid/expired. */
export function bearerSubject(req: Request, now: Date = new Date()): Subject | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  const result = verifySession(token, sessionSecret(), now);
  return result.ok ? result.subject : null;
}
