import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type ScheduleUpdate = Database["public"]["Tables"]["ordering_schedule"]["Update"];

// Vercel Cron calls this every 5 minutes (vercel.json).
// Checks ordering_schedule and flips is_open based on:
//   1. override_closes_at — one-shot close; cleared after firing.
//   2. weekly_open_day/time + weekly_close_day/time — recurring schedule.
//
// Protected by CRON_SECRET (set in Vercel env vars + .envrc).
// Vercel passes it automatically as Authorization: Bearer <secret> for
// cron jobs; for manual testing use the same header.

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET not set — cron endpoint disabled");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("ordering_schedule")
    .select("is_open, weekly_open_day, weekly_open_time, weekly_close_day, weekly_close_time, override_closes_at")
    .eq("is_singleton", true)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "No schedule row" }, { status: 500 });
  }

  const now = new Date();
  let patch: ScheduleUpdate | null = null;
  let action: string | null = null;

  // 1. override_closes_at — highest priority
  if (row.override_closes_at && new Date(row.override_closes_at) <= now) {
    patch = { is_open: false, override_closes_at: null, updated_at: now.toISOString() };
    action = "override-expired → closed";
  }

  // 2. Weekly schedule — only when all four columns are set
  else if (
    row.weekly_open_day != null &&
    row.weekly_open_time != null &&
    row.weekly_close_day != null &&
    row.weekly_close_time != null
  ) {
    const dayNow = now.getDay(); // 0=Sun in UTC; schedule stored in NY time but close enough for V1
    const [oh, om] = row.weekly_open_time.split(":").map(Number);
    const [ch, cm] = row.weekly_close_time.split(":").map(Number);
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    const openMinutes = oh * 60 + om;
    const closeMinutes = ch * 60 + cm;

    const isOpenDay = dayNow === row.weekly_open_day;
    const isCloseDay = dayNow === row.weekly_close_day;

    if (isCloseDay && minutesNow >= closeMinutes && row.is_open) {
      patch = { is_open: false, updated_at: now.toISOString() };
      action = "schedule → closed";
    } else if (isOpenDay && minutesNow >= openMinutes && !row.is_open) {
      patch = { is_open: true, updated_at: now.toISOString() };
      action = "schedule → open";
    }
  }

  if (!action || !patch) {
    return NextResponse.json({ ok: true, action: "no-op" });
  }

  const { error: updateError } = await supabase
    .from("ordering_schedule")
    .update(patch)
    .eq("is_singleton", true);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action });
}
