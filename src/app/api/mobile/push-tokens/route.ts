import { NextResponse } from "next/server";

import { bearerSubject } from "@/lib/auth/bearer";
import { registerPushToken, type Platform } from "@/lib/notifications/push";

// POST /api/mobile/push-tokens  { token, platform } — bearer-guarded. Registers
// the caller's Expo push token to the authenticated admin (upsert on token, so
// re-registration is idempotent). platform must be 'android' | 'ios'.
export async function POST(req: Request) {
  const subject = bearerSubject(req);
  if (!subject) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let token = "";
  let platform = "";
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token : "";
    platform = body?.platform === "ios" || body?.platform === "android" ? body.platform : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!token || !platform) {
    return NextResponse.json(
      { error: "token and platform (android|ios) are required" },
      { status: 400 },
    );
  }

  await registerPushToken(subject.id, token, platform as Platform);
  return NextResponse.json({ ok: true });
}
