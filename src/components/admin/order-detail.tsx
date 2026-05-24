import type { OrderRow as OrderRowData } from "@/lib/admin/orders-queries";

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function OrderDetail({ order }: { order: OrderRowData }) {
  return (
    <div className="ord-detail">
      <div className="ord-detail-grid">
        <div className="ord-detail-section">
          <div className="ord-detail-label">Line items</div>
          <ul className="ord-detail-list">
            {order.items.map((i) => {
              // 6.5f: oversold math is unit-aware. A line of 5 lb (conv=2)
              // consumes 10 base units, so qty_available=8 is oversold by 2
              // base units — not "5 > 8 = false" from the old integer compare.
              const baseRequested = i.qty * i.conversionToBase;
              const oversold = baseRequested > i.qtyAvailable;
              const shortBy = oversold ? baseRequested - i.qtyAvailable : 0;
              return (
                <li key={i.productId} className={oversold ? "is-oversold" : ""}>
                  <span className="ord-li-qty mono">{i.qty}×</span>
                  <span className="ord-li-name">
                    {i.name}
                    <span className="ord-li-unit"> · {i.unitLabel}</span>
                  </span>
                  {oversold && (
                    <span className="ord-li-flag">
                      Only {i.qtyAvailable} {i.unit} available — {shortBy} {i.unit}
                      {shortBy !== 1 ? "s" : ""} oversold
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
