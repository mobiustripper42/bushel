// Public Harvest & Pack Sheet view (#195). Server component — read-only, no
// interactivity. Mobile is the primary surface (farm hands on phones);
// desktop goes two-column and print flows continuously. Layout spec:
// design/fulfillment-report.{jsx,css}. Styles: app.css `.fr-*` section.
import type { FulfillmentReport } from "@/lib/fulfillment/report";

// Drop trailing zeros: 10, 5.5 — never "10.00".
function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}

// Print stamp (NY time): the paper copy is a snapshot, not "regenerated
// live" — render time ≈ print time, which is version enough for the bench.
function printedStamp(): string {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
            {report.orderCount} {report.orderCount === 1 ? "order" : "orders"} ·{" "}
            <span className="fr-no-print">regenerated live</span>
            <span className="fr-print-only">printed {printedStamp()}</span>
          </div>
        </div>
      </header>

      {/* Pick list (#235, reworked on Eric's print review): one flat line
          per product — qty leads, name follows — in the same visual language
          as the slip lines. The harvest decision is the BASE total; the
          per-unit breakdown (what packing needs) rides muted at the end of
          the line. Single column always: two columns made pinning the amount
          to the item harder, and speed-of-scan is the whole point. Section
          titles + helper notes removed — the sheet explains itself. */}
      <section className="fr-section">
        {report.harvest.length === 0 ? (
          <p className="fr-empty">Nothing to harvest — no open orders.</p>
        ) : (
          <ul className="fr-hv-list">
            {report.harvest.map((row) => (
              <li className="fr-hv-line" key={row.productId}>
                {/* Print-only pencil tick box — hidden on screen. */}
                <span className="fr-hv-tick" aria-hidden="true" />
                <span className="fr-hv-qty">{fmt(row.baseTotal)}</span>
                <span className="fr-hv-base">{row.base}</span>
                <span className="fr-hv-product">{row.name}</span>
                {row.showTotal && (
                  <span className="fr-hv-breakdown">
                    {row.units
                      .map((u) => `${fmt(u.qty)} ${u.unit}`)
                      .join(" + ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {report.slips.length > 0 && (
        <section className="fr-section">
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
                      {/* Packing is a check-off job too — same print-only tick. */}
                      <span className="fr-hv-tick" aria-hidden="true" />
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
