"use client";

import { useState, useTransition, Fragment } from "react";

import { advanceOrderStatus } from "@/actions/advance-order-status";
import type { OrderRow as OrderRowData, OrderStatus } from "@/lib/admin/orders-queries";

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

function StatusControl({
  order,
  onAdvance,
  pending,
}: {
  order: OrderRowData;
  onAdvance: (next: OrderStatus) => void;
  pending: boolean;
}) {
  if (order.status === "new") {
    return (
      <div className="status-control">
        <span className="pill pill-new">New</span>
        <button
          type="button"
          className="status-advance"
          onClick={(e) => {
            e.stopPropagation();
            onAdvance("ready");
          }}
          disabled={pending}
        >
          Mark ready →
        </button>
      </div>
    );
  }
  if (order.status === "ready") {
    const terminal: OrderStatus =
      order.fulfillmentType === "pickup" ? "picked-up" : "delivered";
    const label = terminal === "picked-up" ? "Picked up ✓" : "Delivered ✓";
    return (
      <div className="status-control">
        <span className="pill pill-ready">Ready</span>
        <button
          type="button"
          className="status-advance"
          onClick={(e) => {
            e.stopPropagation();
            onAdvance(terminal);
          }}
          disabled={pending}
        >
          {label}
        </button>
      </div>
    );
  }
  if (order.status === "picked-up") {
    return <span className="pill pill-done">Picked up</span>;
  }
  return <span className="pill pill-done">Delivered</span>;
}

function OrderDetail({ order }: { order: OrderRowData }) {
  return (
    <div className="ord-detail">
      <div className="ord-detail-grid">
        <div className="ord-detail-section">
          <div className="ord-detail-label">Line items</div>
          <ul className="ord-detail-list">
            {order.items.map((i) => {
              const oversold = i.qty > i.qtyAvailable;
              const shortBy = oversold ? i.qty - i.qtyAvailable : 0;
              return (
                <li key={i.productId} className={oversold ? "is-oversold" : ""}>
                  <span className="ord-li-qty mono">{i.qty}×</span>
                  <span className="ord-li-name">
                    {i.name}
                    <span className="ord-li-unit"> · {i.unit}</span>
                  </span>
                  {oversold && (
                    <span className="ord-li-flag">
                      Only {i.qtyAvailable} available — {shortBy} oversold
                    </span>
                  )}
                  <span className="ord-li-amt mono">
                    {formatMoney(i.qty * i.unitPriceCents)}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="ord-li-total">
            <span>Total</span>
            <span className="mono">{formatMoney(order.totalCents)}</span>
          </div>
        </div>

        <div className="ord-detail-section">
          <div className="ord-detail-label">Fulfillment</div>
          <div className="ord-detail-fulfill">
            <div className="ord-detail-row">
              <span className="ord-detail-key">Type</span>
              <span>{order.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}</span>
            </div>
            {order.fulfillmentType === "delivery" && order.deliveryAddress && (
              <div className="ord-detail-row">
                <span className="ord-detail-key">Address</span>
                <span>{order.deliveryAddress}</span>
              </div>
            )}
            {order.fulfillmentType === "delivery" && order.deliveryPreference && (
              <div className="ord-detail-row">
                <span className="ord-detail-key">Note</span>
                <span>{order.deliveryPreference}</span>
              </div>
            )}
            {order.fulfillmentType === "pickup" && order.pickupNote && (
              <div className="ord-detail-row">
                <span className="ord-detail-key">Pickup</span>
                <span>{order.pickupNote}</span>
              </div>
            )}
          </div>

          {order.notes && (
            <>
              <div className="ord-detail-label" style={{ marginTop: 18 }}>
                Customer note
              </div>
              <div className="ord-detail-note">&ldquo;{order.notes}&rdquo;</div>
            </>
          )}

          {order.needsReconciliation && (
            <div className="callout callout-warn" style={{ marginTop: 16 }}>
              <strong>This order oversold an item.</strong> The cart was
              optimistic — actual stock didn&rsquo;t match. Adjust quantities or
              text the customer before fulfillment.
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: 36, padding: "0 12px" }}
                  disabled
                  title="Coming in Phase 6"
                >
                  Adjust quantities
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ minHeight: 36, padding: "0 12px" }}
                  disabled
                  title="Coming in Phase 6"
                >
                  Mark resolved
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function OrderRow({ order, isOpen, onToggle }: Props) {
  const [optimisticStatus, setOptimisticStatus] = useState<OrderStatus>(order.status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdvance(next: OrderStatus) {
    setError(null);
    const previous = optimisticStatus;
    setOptimisticStatus(next);
    startTransition(async () => {
      const result = await advanceOrderStatus(order.id, next);
      if (result.error) {
        setOptimisticStatus(previous);
        setError(result.error);
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
            <strong>{view.items.length}</strong> items
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
          <StatusControl order={view} onAdvance={handleAdvance} pending={pending} />
          {error && (
            <div className="ord-row-error" role="alert">
              {error}
            </div>
          )}
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
