"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { pgMessage } from "@/lib/pg-errors";

// #61 — counterpart to deactivateCustomer. Flips is_active back to true.
// Revalidates /admin/customers (the row jumps back into the default view)
// and /admin/inventory (subscribed pill is a consumer of the count).
export async function reactivateCustomer(id: string): Promise<{ error: string | null }> {
  const user = await getAdminUser();
  if (!user) return { error: "Unauthorized" };
  try {
    await query(
      `update customers set is_active = true, updated_at = now() where id = $1`,
      [id],
    );
  } catch (e) {
    return { error: pgMessage(e) };
  }
  revalidatePath("/admin/customers");
  revalidatePath("/admin/inventory");
  return { error: null };
}
