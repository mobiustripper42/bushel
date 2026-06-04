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
  // Path to revalidate after recording. Defaults to the Send page; the
  // Orders-page action stack (#192) passes "/admin/orders". Kept optional so
  // the original 3-arg call sites stay unchanged (#191).
  revalidate: string = "/admin/send",
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Belt-and-suspenders: RLS admin-all is the gate today, but a future
  // policy loosening shouldn't accidentally allow anonymous writes here.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase.from("customer_sends").upsert(
    {
      customer_id: customerId,
      week_of: weekOf,
      mode,
      sent_at: new Date().toISOString(),
      sent_by_user_id: user.id,
    },
    { onConflict: "customer_id,week_of,mode" },
  );

  if (error) return { error: error.message };

  revalidatePath(revalidate);
  return { error: null };
}
