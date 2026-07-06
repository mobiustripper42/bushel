/**
 * Session-cookie glue (DEC-047). The crypto lives in the framework-free
 * session.ts; this is the thin Next layer that reads/writes the httpOnly cookie.
 * Verifying a login code mints the cookie; every request that finds a still-valid
 * one inside the renewal window silently re-issues it (sliding expiry), so an
 * active admin isn't bounced back to a new code.
 */

import { cookies, headers } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  RENEW_WITHIN_MS,
  SESSION_TTL_MS,
  sessionSecret,
} from "./config";
import {
  makeSession,
  shouldRenew,
  signSession,
  verifySession,
  type Subject,
} from "./session";

/**
 * Gate `secure` on the actual transport, not NODE_ENV: WebKit refuses Secure
 * cookies on HTTP localhost, which breaks CI (`npm start` → NODE_ENV=production
 * over http). Vercel terminates TLS and sets x-forwarded-proto=https.
 */
export async function cookieSecure(): Promise<boolean> {
  return (await headers()).get("x-forwarded-proto") === "https";
}

function cookieOptions(expiresAt: string, secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    expires: new Date(expiresAt),
  };
}

/** Mint + set the session cookie (server-action use). */
export async function startSession(subject: Subject): Promise<void> {
  const session = makeSession(subject, new Date(), SESSION_TTL_MS);
  const jar = await cookies();
  jar.set(
    ADMIN_SESSION_COOKIE,
    signSession(session, sessionSecret()),
    cookieOptions(session.expiresAt, await cookieSecure()),
  );
}

/**
 * Read the current subject, or null if absent/invalid/expired. Renews the cookie
 * in place when it's inside the renewal window (best-effort — a read in a context
 * that can't set cookies just skips the renewal).
 */
export async function readSubject(): Promise<Subject | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const now = new Date();
  const result = verifySession(token, sessionSecret(), now);
  if (!result.ok) return null;

  if (shouldRenew(result.session, now, RENEW_WITHIN_MS)) {
    try {
      const renewed = makeSession(result.subject, now, SESSION_TTL_MS);
      jar.set(
        ADMIN_SESSION_COOKIE,
        signSession(renewed, sessionSecret()),
        cookieOptions(renewed.expiresAt, await cookieSecure()),
      );
    } catch {
      // Read-only context (e.g. a Server Component render) — renew next write.
    }
  }
  return result.subject;
}

/** Drop the session (sign-out). */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_SESSION_COOKIE);
}
