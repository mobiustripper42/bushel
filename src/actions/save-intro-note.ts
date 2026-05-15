"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

// Updates the per-cycle intro note on the ordering_schedule singleton. Empty
// string clears it (template treats null and "" the same).
export async function saveIntroNote(text: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // .select().single() surfaces "no row matched" as an error — without it,
  // a missing singleton (migration drift, wrong env) would return success
  // while nothing changed.
  const { error } = await supabase
    .from("ordering_schedule")
    .update({ intro_note: text, updated_at: new Date().toISOString() })
    .eq("is_singleton", true)
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/admin/send");
  return { error: null };
}
