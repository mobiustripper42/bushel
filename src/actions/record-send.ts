"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin/auth";
import type { SendMode } from "@/lib/admin/send-queue-queries";
import { query } from "@/lib/db";
import { pgMessage } from "@/lib/pg-errors";

// Marks a customer as sent for (week, mode). Idempotent — upsert collapses
// repeat taps to a single row. Admin-gated; full-privilege pg write.
export async function recordSend(
  customerId: string,
  weekOf: string,
  mode: SendMode,
  // Path to revalidate after recording. Defaults to the Send page; the
  // Orders-page action stack (#192) passes "/admin/orders". Kept optional so
  // the original 3-arg call sites stay unchanged (#191).
  revalidate: string = "/admin/send",
): Promise<{ error: string | null }> {
  const user = await getAdminUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await query(
      `insert into customer_sends (customer_id, week_of, mode, sent_at, sent_by_user_id)
       values ($1, $2, $3, now(), $4)
       on conflict (customer_id, week_of, mode)
       do update set sent_at = excluded.sent_at, sent_by_user_id = excluded.sent_by_user_id`,
      [customerId, weekOf, mode, user.id],
    );
  } catch (e) {
    return { error: pgMessage(e) };
  }

  revalidatePath(revalidate);
  return { error: null };
}
