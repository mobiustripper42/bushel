"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { SendMode } from "@/lib/admin/send-queue-queries";

// Marks a customer as sent for (week, mode). Idempotent — upsert collapses
// repeat taps to a single row. Uses RLS-gated server client (admin-all policy
// on customer_sends from migration 20260515133545).
export async function recordSend(
  customerId: string,
  weekOf: string,
  mode: SendMode,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("customer_sends").upsert(
    {
      customer_id: customerId,
      week_of: weekOf,
      mode,
      sent_at: new Date().toISOString(),
      sent_by_user_id: user?.id ?? null,
    },
    { onConflict: "customer_id,week_of,mode" },
  );

  if (error) return { error: error.message };

  revalidatePath("/admin/send");
  return { error: null };
}
