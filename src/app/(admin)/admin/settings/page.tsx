import { createClient } from "@/lib/supabase/server";
import { SettingsScheduleCard } from "@/components/admin/SettingsScheduleCard";

export const metadata = { title: "Settings — Bay Branch Farm" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ordering_schedule")
    .select("is_open, weekly_open_day, weekly_open_time, weekly_close_day, weekly_close_time")
    .eq("is_singleton", true)
    .single();

  if (error || !data) {
    return (
      <div style={{ padding: "32px" }}>
        <p style={{ color: "var(--rose-600)" }}>
          Could not load settings: {error?.message ?? "no schedule row found"}
        </p>
      </div>
    );
  }

  const schedule = data;

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
