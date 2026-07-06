"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin/auth";
import { type OrderStatus } from "@/lib/admin/order-status";
import { advanceOrder } from "@/lib/admin/order-mutations";

// Admin gate first, then the shared status write path (DEC-052 parity mechanism
// 1 — same core the /api/mobile route calls). On success, revalidate the Orders
// page; the bearer route skips this (no page cache to bust).
export async function advanceOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
): Promise<{ error: string | null }> {
  const user = await getAdminUser();
  if (!user) return { error: "Unauthorized" };

  const result = await advanceOrder(orderId, nextStatus);
  if (!result.error) revalidatePath("/admin/orders");
  return result;
}
