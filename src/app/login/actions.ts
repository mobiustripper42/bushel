"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import {
  normalizeEmail,
  requestLoginCode,
  verifyLoginCode,
} from "@/lib/auth/login-code";
import { sendLoginCode } from "@/lib/auth/email";
import { cookieSecure, startSession } from "@/lib/auth/session-cookie";

// Carries the entered email across the request→verify step so it never rides
// the URL. httpOnly, short-lived (matches the code TTL).
const PENDING_EMAIL_COOKIE = "bbf_login_email";
const PENDING_EMAIL_TTL_S = 600;

// Only same-origin absolute paths — block open-redirect via ?next=//evil.com.
function safeNext(next: string | null): string | undefined {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return undefined;
}

/**
 * Step 1 — request a code. No-enumeration: always lands on the code screen with
 * the same UI whether or not the email matched an admin; only a match actually
 * sends, and that send is scheduled off the hot path so it isn't a timing oracle.
 */
export async function requestCode(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const next = safeNext(formData.get("next") as string | null);

  const result = await requestLoginCode(email);
  if (result.outcome === "deliver") {
    const { recipientEmail, code } = result;
    after(async () => {
      try {
        await sendLoginCode(recipientEmail, code);
      } catch (e) {
        // Swallowed off the hot path — a failed send must not leak (and must not
        // change the requester-visible response). Surfaced in server logs only.
        console.error("login code send failed:", e);
      }
    });
  }

  const jar = await cookies();
  jar.set(PENDING_EMAIL_COOKIE, normalizeEmail(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: PENDING_EMAIL_TTL_S,
  });

  const params = new URLSearchParams({ step: "code" });
  if (next) params.set("next", next);
  redirect(`/login?${params}`);
}

/** Step 2 — verify the code; on success mint the session and land in /admin. */
export async function verifyCode(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const next = safeNext(formData.get("next") as string | null);

  const jar = await cookies();
  const email = jar.get(PENDING_EMAIL_COOKIE)?.value ?? "";

  const result = await verifyLoginCode(email, code);
  if (!result.ok) {
    const params = new URLSearchParams({ step: "code", error: result.reason });
    if (next) params.set("next", next);
    redirect(`/login?${params}`);
  }

  jar.delete(PENDING_EMAIL_COOKIE);
  await startSession(result.subject);
  redirect(next ?? "/admin");
}
