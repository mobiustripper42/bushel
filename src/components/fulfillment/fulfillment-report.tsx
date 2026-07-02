// Public Harvest & Pack Sheet view (#195). Server component — read-only, no
// interactivity. Mobile is the primary surface (farm hands on phones);
// desktop goes two-column and print flows continuously. Layout spec:
// design/fulfillment-report.{jsx,css}. Styles: app.css `.fr-*` section.
import type { FulfillmentReport } from "@/lib/fulfillment/report";

// Drop trailing zeros: 10, 5.5 — never "10.00".
function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}

export function FulfillmentReportView({
  report,
  weekLabel,
}: {
  report: FulfillmentReport;
  weekLabel: string;
}) {
  return (
    <div className="fr-report">
      <header className="fr-head">
        <div>
          <div className="eyebrow">Bay Branch Farm</div>
          <h1 className="fr-title">Harvest &amp; Pack Sheet</h1>
        </div>
        <div className="fr-meta">
          <div className="fr-week">{weekLabel}</div>
          <div className="fr-sub">
            {report.orderCount} {report.orderCount === 1 ? "order" : "orders"} ·
            regenerated live
          </div>
        </div>
      </header>

      <section className="fr-section">
        <h2 className="fr-section-title">Harvest list</h2>
        {report.harvest.length === 0 ? (
          <p className="fr-empty">No orders yet this week.</p>
        ) : (
          <>
            <p className="fr-note fr-no-print">
              Everything to pick this week, summed across all orders.
            </p>
            <div className="fr-hv-grid">
              {report.harvest.map((row) => (
                <div className="fr-hv-row" key={row.productId}>
                  <div className="fr-hv-name">
                    {/* Print-only pencil tick box (#235) — hidden on screen. */}
                    <span className="fr-hv-tick" aria-hidden="true" />
                    {row.name}
                  </div>
                  <div className="fr-hv-lines">
                    {row.units.map((u) => (
                      <div className="fr-hv-unit" key={u.unit}>
                        <span className="fr-hv-unit-label">{u.unit}</span>
                        <span className="fr-hv-unit-qty">{fmt(u.qty)}</span>
                      </div>
                    ))}
                    {row.showTotal && (
                      <div className="fr-hv-unit fr-hv-total">
                        <span className="fr-hv-unit-label">
                          total {row.base}
                        </span>
                        <span className="fr-hv-unit-qty">
                          {fmt(row.baseTotal)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {report.slips.length > 0 && (
        <section className="fr-section">
          <h2 className="fr-section-title">Packing slips</h2>
          <p className="fr-note fr-no-print">
            One per order — check against the box.
          </p>
          <div className="fr-slip-grid">
            {report.slips.map((slip) => (
              <div className="fr-slip" key={slip.orderId}>
                <div className="fr-slip-head">
                  <div className="fr-slip-customer">{slip.customer}</div>
                  <span className={`fr-slip-tag fr-slip-tag-${slip.fulfillment}`}>
                    {slip.fulfillment === "delivery" ? "Delivery" : "Pickup"}
                  </span>
                </div>
                <div className="fr-slip-where">{slip.where}</div>
                <div className="fr-slip-lines">
                  {slip.lines.map((l, i) => (
                    <div className="fr-slip-line" key={i}>
                      <span className="fr-slip-qty">{fmt(l.qty)}</span>
                      <span className="fr-slip-unit">{l.unit}</span>
                      <span className="fr-slip-product">{l.product}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
