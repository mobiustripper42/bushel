"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/admin/orders-queries";

// DEC-010: new → ready → (picked-up | delivered).
// Fulfillment type pins which terminal state is valid.
function isValidTransition(
  from: OrderStatus,
  to: OrderStatus,
  fulfillmentType: "pickup" | "delivery",
): boolean {
  if (from === "new" && to === "ready") return true;
  if (from === "ready" && to === "picked-up") return fulfillmentType === "pickup";
  if (from === "ready" && to === "delivered") return fulfillmentType === "delivery";
  return false;
}

// Uses cookie-bound client (not admin) — the admin_all_orders RLS policy
// (migration 20260508014838) is the gate on writes here. Matches the
// recordSend pattern.
export async function advanceOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("status, fulfillment_type")
    .eq("id", orderId)
    .single();
  if (readError) return { error: readError.message };
  if (!order) return { error: "Order not found" };

  const from = order.status as OrderStatus;
  const fulfillmentType =
    order.fulfillment_type === "delivery" ? "delivery" : "pickup";

  if (!isValidTransition(from, nextStatus, fulfillmentType)) {
    return {
      error: `Cannot move ${from} → ${nextStatus} (${fulfillmentType})`,
    };
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (updateError) return { error: updateError.message };

  revalidatePath("/admin/orders");
  return { error: null };
}
