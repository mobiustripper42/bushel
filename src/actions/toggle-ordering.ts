"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type ScheduleUpdate = Database["public"]["Tables"]["ordering_schedule"]["Update"];

export type ToggleOrderingAction = "open" | "close" | "resume";

export async function toggleOrdering(action: ToggleOrderingAction): Promise<string | null> {
  const supabase = await createClient();

  const now = new Date().toISOString();
  let patch: ScheduleUpdate;

  if (action === "open") {
    patch = { is_open: true, updated_at: now };
  } else if (action === "close") {
    patch = { is_open: false, override_closes_at: null, updated_at: now };
  } else {
    patch = { override_closes_at: null, updated_at: now };
  }

  const { error } = await supabase
    .from("ordering_schedule")
    .update(patch)
    .eq("is_singleton", true);

  if (error) return error.message;

  revalidatePath("/admin/settings");
  return null;
}
