import { query } from "@/lib/db";
import { SettingsScheduleCard } from "@/components/admin/SettingsScheduleCard";

export const metadata = { title: "Settings — Bay Branch Farm" };

type ScheduleRow = {
  is_open: boolean;
  weekly_open_day: number | null;
  weekly_open_time: string | null;
  weekly_close_day: number | null;
  weekly_close_time: string | null;
};

export default async function SettingsPage() {
  let schedule: ScheduleRow | undefined;
  let loadError: string | null = null;
  try {
    const rows = await query<ScheduleRow>(
      `select is_open, weekly_open_day, weekly_open_time, weekly_close_day,
              weekly_close_time
         from ordering_schedule
        where is_singleton = true`,
    );
    schedule = rows[0];
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  if (loadError || !schedule) {
    return (
      <div style={{ padding: "32px" }}>
        <p style={{ color: "var(--rose-600)" }}>
          Could not load settings: {loadError ?? "no schedule row found"}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px", maxWidth: 860, margin: "0 auto" }}>
      <div className="set-head">
        <div className="eyebrow">Configuration</div>
        <div className="set-title">Settings</div>
        <div className="set-subtitle">
          The rhythm of the week — when ordering opens, when it closes.
        </div>
      </div>

      <div className="set-cards">
        <SettingsScheduleCard schedule={schedule} />
      </div>
    </div>
  );
}
