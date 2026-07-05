"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin/auth";
import { isValidTransition, type OrderStatus } from "@/lib/admin/order-status";
import { query } from "@/lib/db";
import { pgMessage } from "@/lib/pg-errors";

// Admin gate first, then full-privilege pg writes (DEC-048 — the service
// layer is the boundary; RLS is gone).
export async function advanceOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
): Promise<{ error: string | null }> {
  const user = await getAdminUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const rows = await query<{ status: string; fulfillment_type: string }>(
      `select status, fulfillment_type from orders where id = $1`,
      [orderId],
    );
    const order = rows[0];
    if (!order) return { error: "Order not found" };

    const from = order.status as OrderStatus;
    const fulfillmentType =
      order.fulfillment_type === "delivery" ? "delivery" : "pickup";

    if (!isValidTransition(from, nextStatus, fulfillmentType)) {
      return {
        error: `Cannot move ${from} → ${nextStatus} (${fulfillmentType})`,
      };
    }

    await query(
      `update orders set status = $1, updated_at = now() where id = $2`,
      [nextStatus, orderId],
    );
  } catch (e) {
    return { error: pgMessage(e) };
  }

  revalidatePath("/admin/orders");
  return { error: null };
}
