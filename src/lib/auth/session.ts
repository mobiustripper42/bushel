/**
 * Self-rolled admin session tokens (DEC-047, ported from muster's
 * src/auth/session.ts). Simplified to a single subject kind — bushel has one
 * role, `admin`.
 *
 * Stateless by design: the token is `base64url(payload).base64url(HMAC-SHA256)`,
 * so verification needs only the secret — no session table, no DB round-trip on
 * every request. Tamper-evident (a flipped byte fails the HMAC) and self-expiring
 * (the payload carries `expiresAt`). Renewal is re-issue: a still-valid token
 * inside the renewal window mints a fresh one (sliding expiry).
 *
 * Framework-free: pure `node:crypto`, injected `now`. The Next glue that reads
 * and writes the cookie lives in session-cookie.ts, not here — this module is
 * safe to import from the middleware (proxy.ts) where next/headers isn't.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface Session {
  subjectKind: "admin";
  subjectId: string;
  /** ISO-8601 UTC. Past this instant the token is dead. */
  expiresAt: string;
}

export interface Subject {
  kind: "admin";
  id: string;
}

const b64url = (s: string): string => Buffer.from(s, "utf8").toString("base64url");
const unb64url = (s: string): string => Buffer.from(s, "base64url").toString("utf8");

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

/** Mint a signed session token. `expiresAt` is the caller's chosen lifetime. */
export function signSession(session: Session, secret: string): string {
  const payloadB64 = b64url(JSON.stringify(session));
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

/**
 * Build a fresh session for a subject with the given lifetime. Framework-free so
 * both the cookie glue (session-cookie.ts) and the bearer/API path mint the same
 * shape from one place — the token's meaning can't drift between the two entries.
 */
export function makeSession(subject: Subject, now: Date, ttlMs: number): Session {
  return {
    subjectKind: subject.kind,
    subjectId: subject.id,
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  };
}

export type SessionFailure = "malformed" | "bad_signature" | "expired";

export type SessionResult =
  | { ok: true; session: Session; subject: Subject }
  | { ok: false; reason: SessionFailure };

/**
 * Verify a token: well-formed → signature valid (constant-time) → not expired.
 * Returns the session and a convenience `subject` ({kind,id}) on success.
 */
export function verifySession(
  token: string,
  secret: string,
  now: Date,
): SessionResult {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: "malformed" };
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = sign(payloadB64, secret);
  // Constant-time compare; mismatched lengths can't be timing-safe, so guard first.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  let session: Session;
  try {
    session = JSON.parse(unb64url(payloadB64)) as Session;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    typeof session?.subjectId !== "string" ||
    typeof session?.expiresAt !== "string" ||
    session.subjectKind !== "admin"
  ) {
    return { ok: false, reason: "malformed" };
  }
  const exp = Date.parse(session.expiresAt);
  // A non-parseable expiry can't be trusted to be in the future — treat NaN as
  // dead (defense-in-depth; a tampered payload already fails the HMAC above).
  if (Number.isNaN(exp) || now.getTime() >= exp) {
    return { ok: false, reason: "expired" };
  }

  return {
    ok: true,
    session,
    subject: { kind: session.subjectKind, id: session.subjectId },
  };
}

/**
 * Sliding-expiry helper: is a valid token close enough to expiry that the caller
 * should re-issue a fresh one this request? Keeps an active admin logged in
 * without forcing a new code.
 */
export function shouldRenew(
  session: Session,
  now: Date,
  renewWithinMs: number,
): boolean {
  return Date.parse(session.expiresAt) - now.getTime() <= renewWithinMs;
}
