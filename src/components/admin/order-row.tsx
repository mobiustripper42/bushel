"use client";

import { useState, useTransition, Fragment } from "react";

import { advanceOrderStatus } from "@/actions/advance-order-status";
import { OrderDetail } from "@/components/admin/order-detail";
import { OrderActions } from "@/components/admin/order-actions";
import type { OrderRow as OrderRowData, OrderStatus } from "@/lib/admin/orders-queries";
import { totalItemCount } from "@/lib/order-items";

type Props = {
  order: OrderRowData;
  isOpen: boolean;
  onToggle: () => void;
};

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPlaced(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "America/New_York",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  return `${day} · ${time.toLowerCase()}`;
}

function itemsPreview(items: OrderRowData["items"]): string {
  const names = items.slice(0, 3).map((i) => i.name.toLowerCase()).join(", ");
  const extra = items.length > 3 ? `, +${items.length - 3} more` : "";
  return `${names}${extra}`;
}

// Collapsed rows show only the chip (#192). The advance + send controls live
// in OrderActions, rendered under the chip when the row is expanded.
function StatusChip({ status }: { status: OrderStatus }) {
  if (status === "new") return <span className="pill pill-new">New</span>;
  if (status === "confirmed")
    return <span className="pill pill-confirmed">Confirmed</span>;
  if (status === "ready") return <span className="pill pill-ready">Ready</span>;
  if (status === "picked-up")
    return <span className="pill pill-done">Picked up</span>;
  return <span className="pill pill-done">Delivered</span>;
}

export function OrderRow({ order, isOpen, onToggle }: Props) {
  const [optimisticStatus, setOptimisticStatus] = useState<OrderStatus>(order.status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // `quiet` suppresses the error surface — used by the confirm auto-advance,
  // where a rejected new→confirmed (because the order already moved past new,
  // e.g. a mid-flight Mark-ready or double-tap) is non-actionable: the send
  // still succeeded, so we just roll the optimistic status back silently.
  function handleAdvance(next: OrderStatus, quiet = false) {
    setError(null);
    const previous = optimisticStatus;
    setOptimisticStatus(next);
    startTransition(async () => {
      const result = await advanceOrderStatus(order.id, next);
      if (result.error) {
        setOptimisticStatus(previous);
        if (!quiet) setError(result.error);
      }
    });
  }

  const view: OrderRowData = { ...order, status: optimisticStatus };

  return (
    <Fragment>
      <tr
        className={
          "ord-row" +
          (view.needsReconciliation ? " needs-rec" : "") +
          (isOpen ? " is-open" : "")
        }
        data-order-id={order.id}
        data-status={view.status}
        onClick={onToggle}
      >
        <td className="col-o-id">
          <div className="ord-num mono">#{order.id.slice(0, 8)}</div>
          {view.needsReconciliation && (
            <span className="badge-recon">Needs reconciliation</span>
          )}
        </td>
        <td className="col-o-cust">
          <div className="ord-cust-name">{view.customerName}</div>
        </td>
        <td className="col-o-when">
          <div className="ord-when">{formatPlaced(view.placedAt)}</div>
        </td>
        <td className="col-o-items">
          <div className="ord-items-count">
            <strong>{totalItemCount(view.items)}</strong> items
          </div>
          <div className="ord-items-prev">{itemsPreview(view.items)}</div>
        </td>
        <td className="col-o-ful">
          <div className="ord-ful">
            <span className={`chip chip-ful chip-${view.fulfillmentType}`}>
              {view.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}
            </span>
          </div>
        </td>
        <td className="col-o-total">
          <div className="ord-total mono">{formatMoney(view.totalCents)}</div>
        </td>
        <td className="col-o-status" onClick={(e) => e.stopPropagation()}>
          <div className="status-stack">
            <StatusChip status={view.status} />
            {isOpen && (
              <OrderActions
                order={view}
                onAdvance={handleAdvance}
                pending={pending}
              />
            )}
            {error && (
              <div className="ord-row-error" role="alert">
                {error}
              </div>
            )}
          </div>
        </td>
      </tr>
      {isOpen && (
        <tr className="ord-detail-row">
          <td colSpan={7}>
            <OrderDetail order={view} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}
