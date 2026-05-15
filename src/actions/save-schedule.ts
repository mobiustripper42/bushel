"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveScheduleInput = {
  useSchedule: boolean;
  openDay: number;   // 0–6 (Sun=0)
  openTime: string;  // HH:MM
  closeDay: number;
  closeTime: string;
};

export async function saveSchedule(input: SaveScheduleInput): Promise<string | null> {
  const supabase = await createClient();

  const patch = input.useSchedule
    ? {
        weekly_open_day: input.openDay,
        weekly_open_time: input.openTime,
        weekly_close_day: input.closeDay,
        weekly_close_time: input.closeTime,
      }
    : {
        weekly_open_day: null,
        weekly_open_time: null,
        weekly_close_day: null,
        weekly_close_time: null,
      };

  const { error } = await supabase
    .from("ordering_schedule")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("is_singleton", true);

  if (error) return error.message;

  revalidatePath("/admin/settings");
  return null;
}
