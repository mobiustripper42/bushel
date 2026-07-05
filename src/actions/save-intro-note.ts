"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { pgMessage } from "@/lib/pg-errors";

// Updates the per-cycle intro note on the ordering_schedule singleton. Empty
// string clears it (template treats null and "" the same).
export async function saveIntroNote(text: string): Promise<{ error: string | null }> {
  const user = await getAdminUser();
  if (!user) return { error: "Unauthorized" };

  try {
    // RETURNING surfaces "no row matched" — without it, a missing singleton
    // (migration drift, wrong env) would return success while nothing changed.
    const rows = await query<{ id: string }>(
      `update ordering_schedule set intro_note = $1, updated_at = now()
        where is_singleton = true
        returning id`,
      [text],
    );
    if (rows.length === 0) {
      return { error: "saveIntroNote: ordering_schedule singleton missing" };
    }
  } catch (e) {
    return { error: pgMessage(e) };
  }

  revalidatePath("/admin/send");
  return { error: null };
}
