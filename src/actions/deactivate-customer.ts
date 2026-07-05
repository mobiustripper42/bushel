"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { pgMessage } from "@/lib/pg-errors";

export async function deactivateCustomer(id: string): Promise<{ error: string | null }> {
  const user = await getAdminUser();
  if (!user) return { error: "Unauthorized" };
  try {
    await query(
      `update customers set is_active = false, updated_at = now() where id = $1`,
      [id],
    );
  } catch (e) {
    return { error: pgMessage(e) };
  }
  revalidatePath("/admin/customers");
  revalidatePath("/admin/inventory");
  return { error: null };
}
