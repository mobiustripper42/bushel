import { NextResponse } from "next/server";

import { verifyLoginCode } from "@/lib/auth/login-code";
import { makeSession, signSession } from "@/lib/auth/session";
import { SESSION_TTL_MS, sessionSecret } from "@/lib/auth/config";

// POST /api/mobile/auth/verify-code  { email, code }
//   → 200 { token, expiresAt }  — the DEC-047 HMAC session as a bearer token
//   → 401 { error: reason }     — "invalid" | "expired" | "locked"
// Web login step 2 mints the same token into an httpOnly cookie (startSession);
// the app can't read that, so here we return it in the body for the app to store
// (expo-secure-store) and send on every /api/mobile/* call. Same token, same
// 14-day TTL, same secret — it verifies through bearerSubject unchanged.
export async function POST(req: Request) {
  let email = "";
  let code = "";
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email : "";
    code = typeof body?.code === "string" ? body.code.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await verifyLoginCode(email, code);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 401 });
  }

  const session = makeSession(result.subject, new Date(), SESSION_TTL_MS);
  const token = signSession(session, sessionSecret());
  return NextResponse.json({ token, expiresAt: session.expiresAt });
}
