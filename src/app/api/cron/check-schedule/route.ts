import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// DORMANT (DEC-040): the vercel.json crons entry was removed — nothing calls
// this route anymore. The store is always-open; is_open changes only via the
// manual toggle. Machinery left in place, removable anytime.
//
// Checks ordering_schedule and flips is_open based on:
//   1. override_closes_at — one-shot close; cleared after firing.
//   2. weekly_open_day/time + weekly_close_day/time — recurring schedule.
//
// Protected by CRON_SECRET (set in Vercel env vars + .envrc).
// Vercel passes it automatically as Authorization: Bearer <secret> for
// cron jobs; for manual testing use the same header.

type ScheduleRow = {
  is_open: boolean;
  weekly_open_day: number | null;
  weekly_open_time: string | null;
  weekly_close_day: number | null;
  weekly_close_time: string | null;
  override_closes_at: string | null;
};

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

  const rows = await query<ScheduleRow>(
    `select is_open, weekly_open_day, weekly_open_time, weekly_close_day,
            weekly_close_time, override_closes_at
       from ordering_schedule
      where is_singleton = true`,
  );
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "No schedule row" }, { status: 500 });
  }

  const now = new Date();
  let patch: { is_open?: boolean; override_closes_at?: null } | null = null;
  let action: string | null = null;

  // 1. override_closes_at — highest priority
  if (row.override_closes_at && new Date(row.override_closes_at) <= now) {
    patch = { is_open: false, override_closes_at: null };
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
      patch = { is_open: false };
      action = "schedule → closed";
    } else if (isOpenDay && minutesNow >= openMinutes && !row.is_open) {
      patch = { is_open: true };
      action = "schedule → open";
    }
  }

  if (!action || !patch) {
    return NextResponse.json({ ok: true, action: "no-op" });
  }

  try {
    await query(
      `update ordering_schedule
          set is_open = coalesce($1, is_open),
              override_closes_at = case when $2 then null else override_closes_at end,
              updated_at = now()
        where is_singleton = true`,
      [patch.is_open ?? null, "override_closes_at" in patch],
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action });
}
