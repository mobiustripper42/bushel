// Order-status write path (Phase 11.1, DEC-052 parity mechanism 1). The status
// logic lives here once; the two entry wrappers gate and adapt around it —
// the admin Server Action (advance-order-status.ts) is cookie-gated and
// revalidates the page cache, the /api/mobile route is bearer-gated and returns
// JSON. Neither re-implements the transition rules. No auth check inside — the
// wrapper owns the gate (DEC-048: the service layer is the boundary once past it).
import { query } from "@/lib/db";
import { isValidTransition, type OrderStatus } from "@/lib/admin/order-status";
import { pgMessage } from "@/lib/pg-errors";

export type MutationResult = { error: string | null };

function narrowFulfillment(s: string): "pickup" | "delivery" {
  return s === "delivery" ? "delivery" : "pickup";
}

// Validate + write, given the already-read current status. Kept private so both
// entry points read the order row exactly once (no second round-trip) and share
// one copy of the transition-guard + update.
async function applyTransition(
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
  fulfillmentType: "pickup" | "delivery",
): Promise<MutationResult> {
  if (!isValidTransition(from, to, fulfillmentType)) {
    return { error: `Cannot move ${from} → ${to} (${fulfillmentType})` };
  }
  await query(
    `update orders set status = $1, updated_at = now() where id = $2`,
    [to, orderId],
  );
  return { error: null };
}

/**
 * Move an order to `nextStatus` if the transition is legal for its fulfillment
 * type. "Order not found" and an illegal-transition message are returned (not
 * thrown) so both wrappers can surface them; unexpected pg errors come back via
 * pgMessage.
 */
export async function advanceOrder(
  orderId: string,
  nextStatus: OrderStatus,
): Promise<MutationResult> {
  try {
    const rows = await query<{ status: string; fulfillment_type: string }>(
      `select status, fulfillment_type from orders where id = $1`,
      [orderId],
    );
    const order = rows[0];
    if (!order) return { error: "Order not found" };

    return await applyTransition(
      orderId,
      order.status as OrderStatus,
      nextStatus,
      narrowFulfillment(order.fulfillment_type),
    );
  } catch (e) {
    return { error: pgMessage(e) };
  }
}

/**
 * Mark an order fulfilled — the mobile app's single mutation (DEC-050 thin
 * scope). The terminal status is derived server-side from the order's
 * fulfillment_type (pickup → picked_up, delivery → delivered) so the client
 * never has to know the status vocabulary; the transition is still validated
 * (a non-`ready` order fails the same way the admin UI would). Reads the order
 * row once and hands off to the shared apply — no double round-trip.
 */
export async function fulfillOrder(orderId: string): Promise<MutationResult> {
  try {
    const rows = await query<{ status: string; fulfillment_type: string }>(
      `select status, fulfillment_type from orders where id = $1`,
      [orderId],
    );
    const order = rows[0];
    if (!order) return { error: "Order not found" };

    const fulfillmentType = narrowFulfillment(order.fulfillment_type);
    const terminal: OrderStatus =
      fulfillmentType === "delivery" ? "delivered" : "picked_up";
    return await applyTransition(
      orderId,
      order.status as OrderStatus,
      terminal,
      fulfillmentType,
    );
  } catch (e) {
    return { error: pgMessage(e) };
  }
}
