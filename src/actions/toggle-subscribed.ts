"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { pgMessage } from "@/lib/pg-errors";

export async function toggleSubscribed(
  id: string,
  send_weekly_link: boolean,
): Promise<{ error: string | null }> {
  const user = await getAdminUser();
  if (!user) return { error: "Unauthorized" };
  try {
    await query(
      `update customers set send_weekly_link = $1, updated_at = now() where id = $2`,
      [send_weekly_link, id],
    );
  } catch (e) {
    return { error: pgMessage(e) };
  }
  revalidatePath("/admin/customers");
  revalidatePath("/admin/inventory");
  return { error: null };
}
