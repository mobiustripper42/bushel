"use client";

import { SendAction } from "@/components/admin/send-action";
import type { OrderRow as OrderRowData, OrderStatus } from "@/lib/admin/order-status";
import { statusAfterConfirmSend } from "@/lib/admin/order-status";
import {
  deliveryReminderBody,
  orderConfirmationBody,
  pickupReminderBody,
} from "@/lib/notifications/templates";

// Per-order action stack (#192) — shown under the status chip when a row is
// expanded. Confirm + (pickup) reminder reuse the shared SendAction mechanics
// (labeled-button variant); Mark buttons advance status. Plain buttons, no
// icons (design/admin-orders.jsx).
export function OrderActions({
  order,
  onAdvance,
  pending,
}: {
  order: OrderRowData;
  onAdvance: (next: OrderStatus, quiet?: boolean) => void;
  pending: boolean;
}) {
  const isPickup = order.fulfillmentType === "pickup";
  const terminalNext: OrderStatus = isPickup ? "picked_up" : "delivered";
  const terminalLabel = isPickup ? "Mark picked up" : "Mark delivered";

  const readyDone =
    order.status === "ready" ||
    order.status === "picked_up" ||
    order.status === "delivered";
  const terminalDone =
    order.status === "picked_up" || order.status === "delivered";

  return (
    <div className="ord-actions">
      <SendAction
        label="Confirm order"
        customerId={order.customerId}
        phone={order.phone}
        body={orderConfirmationBody({
          customerName: order.customerName,
          fulfillmentType: order.fulfillmentType,
          pickupNote: order.pickupNote,
          deliveryPreference: order.deliveryPreference,
        })}
        weekOf={order.weekOf}
        mode="order_confirmation"
        initialSentAt={order.confirmSentAt}
        revalidate="/admin/orders"
        onRecorded={() => {
          // Auto-advance new → confirmed; never regress a later status. Quiet:
          // if the order already moved past new (mid-flight Mark / double-tap),
          // the server rejects new→confirmed — non-actionable, so don't surface it.
          const next = statusAfterConfirmSend(order.status);
          if (next !== order.status) onAdvance(next, true);
        }}
      />

      <SendAction
        label={isPickup ? "Pickup reminder" : "Delivery reminder"}
        customerId={order.customerId}
        phone={order.phone}
        body={
          isPickup
            ? pickupReminderBody({ customerName: order.customerName })
            : deliveryReminderBody({ customerName: order.customerName })
        }
        weekOf={order.weekOf}
        mode={isPickup ? "pickup_reminder" : "delivery_reminder"}
        initialSentAt={order.reminderSentAt}
        revalidate="/admin/orders"
      />

      <button
        type="button"
        className="status-advance"
        disabled={pending || readyDone}
        onClick={(e) => {
          e.stopPropagation();
          onAdvance("ready");
        }}
      >
        Mark ready
      </button>
      <button
        type="button"
        className="status-advance"
        disabled={pending || terminalDone}
        onClick={(e) => {
          e.stopPropagation();
          onAdvance(terminalNext);
        }}
      >
        {terminalLabel}
      </button>
    </div>
  );
}
