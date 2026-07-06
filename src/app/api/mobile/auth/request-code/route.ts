import { NextResponse, after } from "next/server";

import { requestLoginCode } from "@/lib/auth/login-code";
import { sendLoginCode } from "@/lib/auth/email";

// POST /api/mobile/auth/request-code  { email } → { ok: true }, always.
// The native counterpart of the web login step 1 (src/app/login/actions.ts).
// No-enumeration: the response is identical whether or not the email matched an
// admin; only a match sends, and the send is scheduled off the hot path (after)
// so a match isn't observably slower — no timing oracle. The app holds the email
// itself and posts it again to verify-code (no pending-email cookie needed).
export async function POST(req: Request) {
  let email = "";
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await requestLoginCode(email);
  if (result.outcome === "deliver") {
    const { recipientEmail, code } = result;
    after(async () => {
      try {
        await sendLoginCode(recipientEmail, code);
      } catch (e) {
        // Swallowed off the hot path — a failed send must not leak or change the
        // requester-visible response. Server logs only.
        console.error("login code send failed:", e);
      }
    });
  }

  return NextResponse.json({ ok: true });
}
