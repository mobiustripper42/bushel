"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { pgMessage } from "@/lib/pg-errors";

export type SaveScheduleInput = {
  useSchedule: boolean;
  openDay: number;   // 0–6 (Sun=0)
  openTime: string;  // HH:MM
  closeDay: number;
  closeTime: string;
};

export async function saveSchedule(input: SaveScheduleInput): Promise<string | null> {
  const user = await getAdminUser();
  if (!user) return "Unauthorized";

  const values = input.useSchedule
    ? [input.openDay, input.openTime, input.closeDay, input.closeTime]
    : [null, null, null, null];

  try {
    await query(
      `update ordering_schedule
          set weekly_open_day = $1, weekly_open_time = $2,
              weekly_close_day = $3, weekly_close_time = $4,
              updated_at = now()
        where is_singleton = true`,
      values,
    );
  } catch (e) {
    return pgMessage(e);
  }

  revalidatePath("/admin/settings");
  return null;
}
