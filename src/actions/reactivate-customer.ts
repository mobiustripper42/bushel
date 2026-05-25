"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// #61 — counterpart to deactivateCustomer. Flips is_active back to true.
// Revalidates /admin/customers (the row jumps back into the default view)
// and /admin/inventory (subscribed pill is a consumer of the count).
export async function reactivateCustomer(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/customers");
  revalidatePath("/admin/inventory");
  return { error: null };
}
