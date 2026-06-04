/* Fulfillment · Harvest & Pack Sheet (public tokenized report) */

const { useMemo } = React;

// Seed orders model the real shape: each line carries the product, the unit
// the customer actually ordered in, that unit's conversion_to_base, and the
// product's base unit. The harvest rollup is COMPUTED from these lines below
// (group by product, then by unit; base total = Σ qty × conversion_to_base) —
// the same math place_order runs — so the consolidated list and the slips
// can never disagree.
const ORDERS = [
  {
    customer: "Spice Kitchen + Bar",
    fulfillment: "delivery",
    where: "5800 Detroit Ave, Cleveland",
    lines: [
      { product: "Heirloom tomatoes", unit: "lb", conv: 1, base: "lb", qty: 8 },
      { product: "Lettuce", unit: "8 oz bag", conv: 0.5, base: "lb", qty: 6 },
      { product: "Genovese basil", unit: "bunch", conv: 1, base: "bunch", qty: 4 },
      { product: "Eggs", unit: "dozen", conv: 1, base: "dozen", qty: 3 },
    ],
  },
  {
    customer: "Bar Cento",
    fulfillment: "delivery",
    where: "1948 W 25th St, Cleveland",
    lines: [
      { product: "Heirloom tomatoes", unit: "lb", conv: 1, base: "lb", qty: 6 },
      { product: "Dino kale", unit: "bunch", conv: 1, base: "bunch", qty: 4 },
      { product: "Carrots", unit: "2 lb bag", conv: 2, base: "lb", qty: 3 },
    ],
  },
  {
    customer: "West Side Market — Bay Stand",
    fulfillment: "pickup",
    where: "Farm pickup",
    lines: [
      { product: "Heirloom tomatoes", unit: "lb", conv: 1, base: "lb", qty: 8 },
      { product: "Lettuce", unit: "pound", conv: 1, base: "lb", qty: 5 },
      { product: "Lettuce", unit: "8 oz bag", conv: 0.5, base: "lb", qty: 4 },
      { product: "Genovese basil", unit: "bunch", conv: 1, base: "bunch", qty: 8 },
      { product: "Eggs", unit: "half-dozen", conv: 0.5, base: "dozen", qty: 6 },
      { product: "Carrots", unit: "pound", conv: 1, base: "lb", qty: 4 },
    ],
  },
  {
    customer: "The Plum Café",
    fulfillment: "delivery",
    where: "4133 Lorain Ave, Cleveland",
    lines: [
      { product: "Dino kale", unit: "bunch", conv: 1, base: "bunch", qty: 5 },
      { product: "Eggs", unit: "dozen", conv: 1, base: "dozen", qty: 5 },
    ],
  },
];

// ── rollup ──────────────────────────────────────────────────────────────
// number formatting: drop trailing zeros (10, 5.5) — never "10.00".
function fmt(n) {
  return Number(n.toFixed(2)).toString();
}

function buildHarvest(orders) {
  const byProduct = new Map();
  for (const o of orders) {
    for (const l of o.lines) {
      if (!byProduct.has(l.product)) {
        byProduct.set(l.product, { product: l.product, base: l.base, units: new Map(), baseTotal: 0 });
      }
      const p = byProduct.get(l.product);
      p.units.set(l.unit, (p.units.get(l.unit) ?? 0) + l.qty);
      p.baseTotal += l.qty * l.conv;
      // remember each unit's conversion for the single-unit/base check
      p[`__conv_${l.unit}`] = l.conv;
    }
  }
  return [...byProduct.values()]
    .map((p) => {
      const units = [...p.units.entries()].map(([unit, qty]) => ({ unit, qty }));
      // Show the folded base total only when it adds information: more than
      // one ordered unit, or a single unit that isn't already the base unit.
      const single = units.length === 1;
      const onlyConv = single ? p[`__conv_${units[0].unit}`] : null;
      const showTotal = !single || onlyConv !== 1;
      return { product: p.product, base: p.base, units, baseTotal: p.baseTotal, showTotal };
    })
    .sort((a, b) => a.product.localeCompare(b.product));
}

function HarvestRow({ row }) {
  return (
    <div className="hv-row">
      <div className="hv-name">{row.product}</div>
      <div className="hv-lines">
        {row.units.map((u) => (
          <div className="hv-unit" key={u.unit}>
            <span className="hv-unit-label">{u.unit}</span>
            <span className="hv-unit-qty">{fmt(u.qty)}</span>
          </div>
        ))}
        {row.showTotal && (
          <div className="hv-unit hv-total">
            <span className="hv-unit-label">total {row.base}</span>
            <span className="hv-unit-qty">{fmt(row.baseTotal)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Slip({ order }) {
  return (
    <div className="slip">
      <div className="slip-head">
        <div className="slip-customer">{order.customer}</div>
        <span className={`slip-tag slip-tag-${order.fulfillment}`}>
          {order.fulfillment === "delivery" ? "Delivery" : "Pickup"}
        </span>
      </div>
      <div className="slip-where">{order.where}</div>
      <div className="slip-lines">
        {order.lines.map((l, i) => (
          <div className="slip-line" key={i}>
            <span className="slip-qty">{fmt(l.qty)}</span>
            <span className="slip-unit">{l.unit}</span>
            <span className="slip-product">{l.product}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FulfillmentReport() {
  const harvest = useMemo(() => buildHarvest(ORDERS), []);
  const orderCount = ORDERS.length;

  return (
    <div className="report">
      <header className="report-head">
        <div>
          <div className="eyebrow">Bay Branch Farm</div>
          <h1 className="report-title">Harvest &amp; Pack Sheet</h1>
        </div>
        <div className="report-meta">
          <div className="report-week">Week of Mon, Jun 2</div>
          <div className="report-sub">{orderCount} orders · regenerated live</div>
        </div>
      </header>

      <section className="report-section harvest-block">
        <h2 className="section-title">Harvest list</h2>
        <p className="section-note no-print">
          Everything to pick this week, summed across all orders.
        </p>
        <div className="hv-grid">
          {harvest.map((row) => (
            <HarvestRow row={row} key={row.product} />
          ))}
        </div>
      </section>

      <section className="report-section slips-block">
        <h2 className="section-title">Packing slips</h2>
        <p className="section-note no-print">One per order — check against the box.</p>
        <div className="slip-grid">
          {ORDERS.map((o) => (
            <Slip order={o} key={o.customer} />
          ))}
        </div>
      </section>
    </div>
  );
}

window.FulfillmentReport = FulfillmentReport;
