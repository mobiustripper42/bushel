/* Admin · Orders */

const { useState, useMemo } = React;

const SEED_ORDERS = [
  {
    id: "ord-0503-04", customer: "Spice Kitchen + Bar",
    placed: "Tue · 10:42am",
    items: [
      { name: "Heirloom tomatoes", qty: 8, unit: "lb",    price: 5.50, oversold: false },
      { name: "Genovese basil",    qty: 4, unit: "bunch", price: 3.50, oversold: false },
      { name: "Sungold cherry tomatoes", qty: 6, unit: "pint", price: 6.00, oversold: true, available: 4 },
      { name: "Garlic scapes",     qty: 3, unit: "bunch", price: 4.00, oversold: false },
    ],
    fulfillment: { type: "delivery", when: "Wed 8am – noon", address: "5800 Detroit Ave, Cleveland" },
    notes: "Please knock at the kitchen entrance — front door is locked until 11.",
    status: "new", needsReconciliation: true,
  },
  {
    id: "ord-0503-03", customer: "Bar Cento",
    placed: "Tue · 9:18am",
    items: [
      { name: "Heirloom tomatoes", qty: 6, unit: "lb",    price: 5.50 },
      { name: "Dino kale",         qty: 4, unit: "bunch", price: 4.50 },
      { name: "Rainbow chard",     qty: 3, unit: "bunch", price: 4.50 },
    ],
    fulfillment: { type: "delivery", when: "Wed 8am – noon", address: "1948 W 25th St, Cleveland" },
    notes: "",
    status: "confirmed", needsReconciliation: false, confirmSent: true,
  },
  {
    id: "ord-0503-02", customer: "West Side Market — Bay Stand",
    placed: "Mon · 7:32pm",
    items: [
      { name: "Heirloom tomatoes",     qty: 12, unit: "lb",    price: 5.50 },
      { name: "Sungold cherry tomatoes", qty: 4, unit: "pint", price: 6.00 },
      { name: "Genovese basil",        qty: 6, unit: "bunch", price: 3.50 },
      { name: "Zucchini",              qty: 8, unit: "ea",    price: 2.50 },
      { name: "Zinnia bouquet",        qty: 2, unit: "bunch", price: 12.00 },
      { name: "Red beets",             qty: 4, unit: "lb",    price: 3.25 },
    ],
    fulfillment: { type: "pickup", when: "Sat 9am – 11am" },
    notes: "Annabel — can you label the basil clamshells with the variety? Customers ask.",
    status: "ready", needsReconciliation: false,
  },
  {
    id: "ord-0503-01", customer: "The Plum Café",
    placed: "Mon · 4:51pm",
    items: [
      { name: "Dino kale",       qty: 5, unit: "bunch", price: 4.50 },
      { name: "Garlic scapes",   qty: 4, unit: "bunch", price: 4.00 },
      { name: "Rainbow chard",   qty: 3, unit: "bunch", price: 4.50 },
    ],
    fulfillment: { type: "delivery", when: "Wed 8am – noon", address: "4133 Lorain Ave, Cleveland" },
    notes: "",
    status: "delivered", needsReconciliation: false,
  },
  {
    id: "ord-0426-08", customer: "Lakewood Farmer's Market",
    placed: "Sun · 11:24am",
    items: [
      { name: "Zinnia bouquet",   qty: 4, unit: "bunch", price: 12.00 },
      { name: "Genovese basil",   qty: 8, unit: "bunch", price: 3.50 },
    ],
    fulfillment: { type: "pickup", when: "Sat 9am – 11am" },
    notes: "",
    status: "picked-up", needsReconciliation: false,
  },
];

const STATUS_FLOW = ["new", "ready", "out"]; // "out" splits into picked-up / delivered

function OrdersPage() {
  const [orders, setOrders] = useState(SEED_ORDERS);
  const [expanded, setExpanded] = useState(SEED_ORDERS[0].id);
  const [filter, setFilter] = useState("week");
  const [sort, setSort] = useState({ key: "placed", dir: "desc" });

  const sorted = useMemo(() => {
    const copy = [...orders];
    // pin reconciliation flags
    copy.sort((a, b) => {
      if (a.needsReconciliation !== b.needsReconciliation) return a.needsReconciliation ? -1 : 1;
      return 0;
    });
    return copy;
  }, [orders, sort]);

  const advance = (id, next) =>
    setOrders(os => os.map(o => o.id === id ? { ...o, status: next } : o));

  const send = (id, kind) =>
    setOrders(os => os.map(o => {
      if (o.id !== id) return o;
      if (kind === "confirm") {
        return { ...o, confirmSent: true, status: o.status === "new" ? "confirmed" : o.status };
      }
      return { ...o, reminderSent: true };
    }));

  const totals = (o) => o.items.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <div className="ord-page">
      <div className="admin-page-head">
        <div>
          <div className="eyebrow" style={{marginBottom: 6}}>{orders.length} orders · {orders.filter(o=>o.needsReconciliation).length} need reconciliation</div>
          <h1 className="admin-page-title">Orders</h1>
        </div>
        <div className="admin-page-actions">
          <SplitButton/>
        </div>
      </div>

      <div className="ord-filters">
        <button className={"chip-tab" + (filter==="week" ? " is-on" : "")} onClick={() => setFilter("week")}>
          This week <span className="chip-count">5</span>
        </button>
        <button className={"chip-tab" + (filter==="last" ? " is-on" : "")} onClick={() => setFilter("last")}>
          Last week <span className="chip-count">7</span>
        </button>
        <button className={"chip-tab" + (filter==="range" ? " is-on" : "")} onClick={() => setFilter("range")}>
          <IconCal/> Custom range
        </button>
        <div className="ord-filters-spacer"></div>
        <div className="ord-search">
          <IconSearch/>
          <input type="text" placeholder="Search customer or order #…"/>
        </div>
      </div>

      <div className="ord-tableCard">
        <table className="ord-table">
          <thead>
            <tr>
              <th className="col-o-id">Order</th>
              <th className="col-o-cust">Customer</th>
              <th className="col-o-when">Placed</th>
              <th className="col-o-items">Items</th>
              <th className="col-o-ful">Fulfillment</th>
              <th className="col-o-total">Total</th>
              <th className="col-o-status">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(o => {
              const total = totals(o);
              const isOpen = expanded === o.id;
              const itemsPreview = o.items.slice(0, 3).map(i => i.name.toLowerCase()).join(", ") + (o.items.length > 3 ? `, +${o.items.length - 3} more` : "");
              return (
                <React.Fragment key={o.id}>
                  <tr
                    className={"ord-row" + (o.needsReconciliation ? " needs-rec" : "") + (isOpen ? " is-open" : "")}
                    onClick={() => setExpanded(isOpen ? null : o.id)}
                  >
                    <td className="col-o-id">
                      <div className="ord-num mono">#{o.id.split("-").slice(1).join("-")}</div>
                      {o.needsReconciliation && (
                        <span className="badge-recon"><IconAlert/> Needs reconciliation</span>
                      )}
                    </td>
                    <td className="col-o-cust">
                      <div className="ord-cust-name">{o.customer}</div>
                    </td>
                    <td className="col-o-when">
                      <div className="ord-when">{o.placed}</div>
                    </td>
                    <td className="col-o-items">
                      <div className="ord-items-count"><strong>{o.items.reduce((sum, i) => sum + i.qty, 0)}</strong> items</div>
                      <div className="ord-items-prev">{itemsPreview}</div>
                    </td>
                    <td className="col-o-ful">
                      <div className="ord-ful">
                        <span className={"chip chip-ful chip-" + o.fulfillment.type}>
                          {o.fulfillment.type === "delivery" ? "Delivery" : "Pickup"}
                        </span>
                        <span className="ord-ful-when">{o.fulfillment.when}</span>
                      </div>
                    </td>
                    <td className="col-o-total">
                      <div className="ord-total mono">${total.toFixed(2)}</div>
                    </td>
                    <td className="col-o-status" onClick={e => e.stopPropagation()}>
                      <StatusControl order={o} onAdvance={advance} onSend={send}/>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="ord-detail-row">
                      <td colSpan={7}>
                        <OrderDetail order={o} total={total}/>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusChip({ status }) {
  if (status === "new")       return <span className="pill pill-new">New</span>;
  if (status === "confirmed") return <span className="pill pill-confirmed">Confirmed</span>;
  if (status === "ready")     return <span className="pill pill-ready">Ready</span>;
  if (status === "picked-up") return <span className="pill pill-done">Picked up</span>;
  if (status === "delivered") return <span className="pill pill-done">Delivered</span>;
  return null;
}

function SendAction({ label, sent, onSend }) {
  return (
    <div className="send-action">
      <span className="send-action-label">{label}</span>
      {sent && <span className="send-action-sent">Sent</span>}
      <button type="button" className="btn-send" onClick={onSend}>
        {sent ? "Re-send" : "Send"}
      </button>
    </div>
  );
}

function StatusControl({ order, onAdvance, onSend }) {
  const s = order.status;
  const isPickup = order.fulfillment.type === "pickup";

  // Terminal states: chip only.
  if (s === "picked-up" || s === "delivered") {
    return <div className="status-stack"><StatusChip status={s}/></div>;
  }

  const reminderLabel = isPickup ? "Pickup reminder" : "Delivery reminder";
  const advanceLabel  = s === "ready" ? (isPickup ? "Mark picked up" : "Mark delivered") : "Mark ready";
  const advanceNext   = s === "ready" ? (isPickup ? "picked-up" : "delivered") : "ready";

  return (
    <div className="status-stack">
      <StatusChip status={s}/>
      <div className="status-actions">
        {s !== "ready" && (
          <SendAction
            label="Confirm order"
            sent={order.confirmSent}
            onSend={() => onSend(order.id, "confirm")}
          />
        )}
        <SendAction
          label={reminderLabel}
          sent={order.reminderSent}
          onSend={() => onSend(order.id, "reminder")}
        />
        <button
          type="button"
          className="status-advance status-advance-block"
          onClick={() => onAdvance(order.id, advanceNext)}
        >
          {advanceLabel}
        </button>
      </div>
    </div>
  );
}

function OrderDetail({ order, total }) {
  return (
    <div className="ord-detail">
      <div className="ord-detail-grid">
        <div className="ord-detail-section">
          <div className="ord-detail-label">Line items</div>
          <ul className="ord-detail-list">
            {order.items.map((i, idx) => (
              <li key={idx} className={i.oversold ? "is-oversold" : ""}>
                <span className="ord-li-qty mono">{i.qty}×</span>
                <span className="ord-li-name">{i.name}<span className="ord-li-unit"> · {i.unit}</span></span>
                {i.oversold && (
                  <span className="ord-li-flag">
                    <IconAlert/> Only {i.available} available — {i.qty - i.available} oversold
                  </span>
                )}
                <span className="ord-li-amt mono">${(i.qty * i.price).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="ord-li-total">
            <span>Total</span>
            <span className="mono">${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="ord-detail-section">
          <div className="ord-detail-label">Fulfillment</div>
          <div className="ord-detail-fulfill">
            <div className="ord-detail-row"><span className="ord-detail-key">Type</span><span>{order.fulfillment.type === "delivery" ? "Delivery" : "Pickup"}</span></div>
            <div className="ord-detail-row"><span className="ord-detail-key">Window</span><span>{order.fulfillment.when}</span></div>
            {order.fulfillment.address && (
              <div className="ord-detail-row"><span className="ord-detail-key">Address</span><span>{order.fulfillment.address}</span></div>
            )}
          </div>

          {order.notes && (
            <>
              <div className="ord-detail-label" style={{marginTop: 18}}>Customer note</div>
              <div className="ord-detail-note">"{order.notes}"</div>
            </>
          )}

          {order.needsReconciliation && (
            <div className="callout callout-warn" style={{marginTop: 16}}>
              <strong>This order oversold an item.</strong> The cart was optimistic — actual stock didn't match. Adjust quantities below or text the customer before fulfillment.
              <div style={{marginTop: 10, display: "flex", gap: 8}}>
                <button type="button" className="btn btn-secondary" style={{minHeight: 36, padding: "0 12px"}}>Adjust quantities</button>
                <button type="button" className="btn btn-ghost" style={{minHeight: 36, padding: "0 12px"}}>Mark resolved</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SplitButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="split-btn-wrap">
      <button type="button" className="split-btn-main" onClick={() => setOpen(o => !o)}>
        <IconExport/>
        <span>Export to Wave</span>
        <span className="split-btn-divider"></span>
        <span className="split-btn-chev"><IconCaret/></span>
      </button>
      {open && (
        <>
          <div className="split-scrim" onClick={() => setOpen(false)}></div>
          <div className="split-menu">
            <button type="button" className="split-item">
              <div>
                <div className="split-item-title">Download CSV</div>
                <div className="split-item-sub">Open in Wave's import flow.</div>
              </div>
            </button>
            <button type="button" className="split-item">
              <div>
                <div className="split-item-title">Copy as TSV</div>
                <div className="split-item-sub">Paste into a spreadsheet directly.</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function IconAlert() { return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z"/><path d="M12 9v4 M12 17h.01"/></svg>; }
function IconArrow() { return <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14 M13 6l6 6-6 6"/></svg>; }
function IconCheck() { return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>; }
function IconCal()   { return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18 M8 3v4 M16 3v4"/></svg>; }
function IconSearch(){ return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>; }
function IconExport(){ return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12 M7 8l5-5 5 5 M5 21h14"/></svg>; }
function IconCaret() { return <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>; }

window.OrdersPage = OrdersPage;
