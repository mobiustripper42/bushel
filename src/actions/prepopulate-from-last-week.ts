"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function prepopulateFromLastWeek(): Promise<{ error: string | null; restoredCount: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("prepopulate_inventory_from_last_week");

  if (error) return { error: error.message, restoredCount: 0 };

  revalidatePath("/admin/inventory");
  return { error: null, restoredCount: data?.length ?? 0 };
}
