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

    const from = order.status as OrderStatus;
    const fulfillmentType =
      order.fulfillment_type === "delivery" ? "delivery" : "pickup";

    if (!isValidTransition(from, nextStatus, fulfillmentType)) {
      return { error: `Cannot move ${from} → ${nextStatus} (${fulfillmentType})` };
    }

    await query(
      `update orders set status = $1, updated_at = now() where id = $2`,
      [nextStatus, orderId],
    );
  } catch (e) {
    return { error: pgMessage(e) };
  }
  return { error: null };
}

/**
 * Mark an order fulfilled — the mobile app's single mutation (DEC-050 thin
 * scope). The terminal status is derived server-side from the order's
 * fulfillment_type (pickup → picked_up, delivery → delivered) so the client
 * never has to know the status vocabulary; the transition is still validated by
 * advanceOrder (a non-`ready` order fails the same way the admin UI would).
 */
export async function fulfillOrder(orderId: string): Promise<MutationResult> {
  const rows = await query<{ fulfillment_type: string }>(
    `select fulfillment_type from orders where id = $1`,
    [orderId],
  );
  const order = rows[0];
  if (!order) return { error: "Order not found" };

  const terminal: OrderStatus =
    order.fulfillment_type === "delivery" ? "delivered" : "picked_up";
  return advanceOrder(orderId, terminal);
}
