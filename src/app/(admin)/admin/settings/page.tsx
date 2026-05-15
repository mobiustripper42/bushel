import { createClient } from "@/lib/supabase/server";
import { SettingsScheduleCard } from "@/components/admin/SettingsScheduleCard";

export const metadata = { title: "Settings — Bay Branch Farm" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ordering_schedule")
    .select("is_open, weekly_open_day, weekly_open_time, weekly_close_day, weekly_close_time")
    .eq("is_singleton", true)
    .single();

  const schedule = data ?? {
    is_open: true,
    weekly_open_day: null,
    weekly_open_time: null,
    weekly_close_day: null,
    weekly_close_time: null,
  };

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
