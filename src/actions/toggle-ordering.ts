"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { pgMessage } from "@/lib/pg-errors";

export type ToggleOrderingAction = "open" | "close" | "resume";

export async function toggleOrdering(action: ToggleOrderingAction): Promise<string | null> {
  const user = await getAdminUser();
  if (!user) return "Unauthorized";

  // open: flip on. close: flip off + clear any override. resume: clear the
  // override only (the weekly schedule takes back over).
  const sql =
    action === "open"
      ? `update ordering_schedule set is_open = true, updated_at = now()
          where is_singleton = true`
      : action === "close"
        ? `update ordering_schedule set is_open = false, override_closes_at = null,
                  updated_at = now()
            where is_singleton = true`
        : `update ordering_schedule set override_closes_at = null, updated_at = now()
            where is_singleton = true`;

  try {
    await query(sql);
  } catch (e) {
    return pgMessage(e);
  }

  revalidatePath("/admin/settings");
  return null;
}
