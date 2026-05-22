/* Customer order page — bushel
 * Mobile-first responsive. State driven by tweaks.
 */

const { useState, useMemo, useEffect, useRef } = React;

// ───── Data ──────────────────────────────────────────────────────────
const INVENTORY = [
{ id: "tomato", name: "Heirloom tomatoes", unit: "lb", price: 5.50, avail: 24 },
{ id: "kale", name: "Dino kale", unit: "bunch", price: 4.50, avail: 18 },
{ id: "lettuce", name: "Salanova lettuce", unit: "head", price: 5.00, avail: 14 },
{ id: "beets", name: "Red beets", unit: "lb", price: 3.25, avail: 22 },
{ id: "carrots", name: "Rainbow carrots", unit: "bunch", price: 4.75, avail: 11 },
{ id: "shallots", name: "Shallots", unit: "lb", price: 6.00, avail: 8 },
{ id: "basil", name: "Genovese basil", unit: "bunch", price: 3.50, avail: 6 },
{ id: "flowers", name: "Mixed bouquet", unit: "stem", price: 12.00, avail: 7 },
{ id: "garlic", name: "Music garlic", unit: "head", price: 2.50, avail: 0 }];


const PICKUP_WINDOWS = [
{ id: "w1", label: "Wednesday", time: "10am – 12pm" },
{ id: "w2", label: "Wednesday", time: "4pm – 6pm" },
{ id: "w3", label: "Thursday", time: "10am – 12pm" },
{ id: "w4", label: "Thursday", time: "4pm – 6pm" }];


const CUSTOMER = {
  name: "Lake Road Market",
  contact: "Maya",
  address: "16100 Detroit Ave, Lakewood, OH 44107"
};

// ───── Building blocks ──────────────────────────────────────────────
function Eyebrow({ children, className }) {
  return <div className={"eyebrow " + (className || "")}>{children}</div>;
}

function Stepper({ value, onChange, max, disabled }) {
  const dec = () => !disabled && onChange(Math.max(0, value - 1));
  const inc = () => !disabled && value < max && onChange(value + 1);
  const can_dec = !disabled && value > 0;
  const can_inc = !disabled && value < max;
  return (
    <div className="stepper" role="group" aria-label="quantity">
      <button
        className="stepper-btn"
        onClick={dec}
        disabled={!can_dec}
        aria-label="decrease">
        −</button>
      <div className="stepper-val">{value}</div>
      <button
        className="stepper-btn"
        onClick={inc}
        disabled={!can_inc}
        aria-label="increase">
        +</button>
    </div>);

}

function ItemRow({ item, qty, onQty, soldOut }) {
  const out = soldOut || item.avail === 0;
  const remaining = out ? 0 : item.avail - qty;
  return (
    <div className={"item-row" + (out ? " is-sold-out" : "")}>
      <div className="item-thumb" aria-hidden="true">
        <div className="item-thumb-inner"></div>
      </div>
      <div className="item-body">
        <div className="item-line1">
          <div className="item-name">{item.name}</div>
          <div className="item-price">
            <span className="mono">${item.price.toFixed(2)}</span>
            <span className="item-per"> / {item.unit}</span>
          </div>
        </div>
        <div className="item-line2">
          {out ?
          <span className="item-meta meta-sold-out">Sold out</span> :
          remaining <= 3 ?
          <span className="item-meta meta-low">only {remaining} {item.unit}{remaining !== 1 ? "s" : ""} left</span> :

          <span className="item-meta">{remaining} {item.unit}{remaining !== 1 ? "s" : ""} available</span>
          }
        </div>
      </div>
      <div className="item-stepper">
        <Stepper
          value={qty}
          onChange={onQty}
          max={item.avail}
          disabled={out} />
        
      </div>
    </div>);

}

function FulfillmentTab({ active, onClick, label, sublabel }) {
  return (
    <button
      className={"fulfill-tab" + (active ? " is-active" : "")}
      onClick={onClick}>
      
      <div className="fulfill-tab-label">{label}</div>
      <div className="fulfill-tab-sub">{sublabel}</div>
    </button>);

}

// ───── Page ─────────────────────────────────────────────────────────
function OrderPage({ tweaks }) {
  const [qty, setQty] = useState({
    tomato: 4, kale: 6, lettuce: 0, beets: 2, carrots: 0,
    shallots: 0, basil: 0, flowers: 0, garlic: 0
  });
  const [mode, setMode] = useState(tweaks.mode || "delivery");
  const [window, setWindow] = useState("w1");
  const [notes, setNotes] = useState("");
  const [editingAddr, setEditingAddr] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Sync mode from tweaks
  useEffect(() => {if (tweaks.mode) setMode(tweaks.mode);}, [tweaks.mode]);

  // Force-sold-out tweak
  const inventory = useMemo(() => {
    if (!tweaks.forceSoldOut) return INVENTORY;
    return INVENTORY.map((i) => i.id === "basil" ? { ...i, avail: 0 } : i);
  }, [tweaks.forceSoldOut]);

  useEffect(() => {
    if (tweaks.forceSoldOut) setQty((q) => ({ ...q, basil: 0 }));
  }, [tweaks.forceSoldOut]);

  const setItemQty = (id, n) => setQty((q) => ({ ...q, [id]: n }));

  const items_with_qty = inventory.filter((i) => qty[i.id] > 0);
  const subtotal = items_with_qty.reduce((s, i) => s + qty[i.id] * i.price, 0);
  const itemCount = items_with_qty.reduce((s, i) => s + qty[i.id], 0);
  const lineCount = items_with_qty.length;

  const submit = () => {
    if (lineCount === 0) return;
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2400);
  };

  const fulfillRef = useRef(null);
  const scrollToFulfill = () => {
    fulfillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={"order-page vp-" + (tweaks.viewport || "mobile")}>
      {/* Top brand strip */}
      <div className="brand-strip">
        <div className="brand-mark">
          <span className="brand-leaf" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M21.5 2.5c0 8-4.5 14.5-12 14.5-1.4 0-2.8-.2-4-.7l1.4-1.4c.8.2 1.7.4 2.6.4 6 0 9.5-5.3 10-12.3-2 .6-7.4 2.6-10.4 7.4-1 1.6-1.5 3.4-1.7 5.4l-1.5 1.5c0-3.3.7-6.3 2.4-8.7C11.4 4 18.4 2.6 21.5 2.5z" />
            </svg>
          </span>
          <span className="brand-name">Bay Branch Farm</span>
        </div>
        <a href="#help" className="brand-help">Help</a>
      </div>

      <div className="page-shell">

        {/* Header ─────────────────────────────────────── */}
        <header className="page-head">
          <Eyebrow>this week · may 3 – may 9</Eyebrow>
          <h1 className="page-title">What's available</h1>
          <p className="page-greet">
            Hi, {CUSTOMER.contact} at <span className="customer-name">{CUSTOMER.name}</span>.
            Order by Tuesday 9pm.
          </p>

          {tweaks.showNote &&
          <div className="annabels-note">
              <Eyebrow>note from annabel</Eyebrow>
              <p>
                <em>"Heirloom tomatoes are exceptional this week — first real flush from the high tunnel.
                Basil is winding down before the cool nights."</em>
              </p>
            </div>
          }
        </header>

        {/* Two-column desktop layout */}
        <div className="page-cols">

          <div className="page-main">

            {/* Inventory ──────────────────────────────────── */}
            <section className="inv">
              <div className="inv-head">
                <Eyebrow>availability</Eyebrow>
                <span className="inv-count">{inventory.filter((i) => i.avail > 0).length} items</span>
              </div>
              <div className="item-list">
                {inventory.map((i) =>
                <ItemRow
                  key={i.id}
                  item={i}
                  qty={qty[i.id] || 0}
                  onQty={(n) => setItemQty(i.id, n)} />

                )}
              </div>
            </section>

            {/* Fulfillment ──────────────────────────────── */}
            <section className="fulfill" ref={fulfillRef}>
              <Eyebrow>fulfillment</Eyebrow>
              <h2 className="section-title">How would you like it?</h2>
              <div className="fulfill-tabs">
                <FulfillmentTab
                  active={mode === "delivery"}
                  onClick={() => setMode("delivery")}
                  label="Delivery"
                  sublabel="Wednesday morning" />
                
                <FulfillmentTab
                  active={mode === "pickup"}
                  onClick={() => setMode("pickup")}
                  label="Pickup at farm"
                  sublabel="3612 W 114th, Cleveland" />
                
              </div>

              {mode === "delivery" ?
              <div className="fulfill-detail">
                  <div className="addr-row">
                    <div className="addr-stack">
                      <div className="label-sm">Delivery to</div>
                      {editingAddr ?
                    <textarea
                      className="textarea"
                      rows="2"
                      defaultValue={CUSTOMER.address}
                      onBlur={() => setEditingAddr(false)}
                      autoFocus /> :


                    <div className="addr-text">{CUSTOMER.address}</div>
                    }
                    </div>
                    {!editingAddr &&
                  <button
                    className="link-btn"
                    onClick={() => setEditingAddr(true)}>
                    Edit</button>
                  }
                  </div>
                  <div className="fulfill-help">
                    Wednesday between 8am and noon. We'll text when we're 30 minutes out.
                  </div>
                </div> :

              <div className="fulfill-detail">
                  <div className="label-sm" style={{ marginBottom: 10 }}>Pick a window</div>
                  <div className="windows">
                    {PICKUP_WINDOWS.map((w) =>
                  <label
                    key={w.id}
                    className={"window" + (window === w.id ? " is-selected" : "")}>
                    
                        <input
                      type="radio"
                      name="window"
                      checked={window === w.id}
                      onChange={() => setWindow(w.id)} />
                    
                        <div className="window-content">
                          <div className="window-day">{w.label}</div>
                          <div className="window-time">{w.time}</div>
                        </div>
                        <div className="window-radio" aria-hidden="true">
                          <div className="window-radio-dot"></div>
                        </div>
                      </label>
                  )}
                  </div>
                  <div className="fulfill-help">
                    Pick up at the farm. Annabel will text you the morning of.
                  </div>
                </div>
              }
            </section>

            {/* Notes ──────────────────────────────────── */}
            <section className="notes">
              <Eyebrow>notes</Eyebrow>
              <h2 className="section-title">Anything else?</h2>
              <textarea
                className="textarea"
                rows="3"
                placeholder="Optional. Anything Annabel should know — substitutions you're open to, bunch sizes, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)} />
              
            </section>

            {/* Submit row (visible at end of scroll on mobile, primary on desktop) */}
            <section className="submit-block" style={{ fontFamily: "-apple-system" }}>
              <div className="submit-summary">
                <div className="summary-line">
                  <span className="summary-label">{lineCount} item{lineCount !== 1 ? "s" : ""}</span>
                  <span className="summary-total mono">${subtotal.toFixed(2)}</span>
                </div>
                <div className="summary-sub">
                  {mode === "delivery" ?
                  "Wednesday delivery to " + CUSTOMER.address.split(",")[0] :
                  "Pickup " + PICKUP_WINDOWS.find((w) => w.id === window)?.label + " " + PICKUP_WINDOWS.find((w) => w.id === window)?.time}
                </div>
              </div>
              <button
                className="btn btn-primary submit-btn"
                onClick={submit}
                disabled={lineCount === 0}>
                
                {submitted ? "Order placed — thanks." : "Submit order"}
              </button>
              <p className="submit-fine">
                You'll get a text confirmation. To change anything, text Annabel at 216-202-5718.
              </p>
            </section>
          </div>

          {/* Right rail — desktop only */}
          <aside className="page-rail">
            <div className="rail-card">
              <Eyebrow>your order</Eyebrow>
              {lineCount === 0 ?
              <div className="rail-empty">
                  Nothing selected yet. Tap <span className="mono">+</span> on items above.
                </div> :

              <ul className="rail-list">
                  {items_with_qty.map((i) =>
                <li key={i.id}>
                      <span className="rail-name">
                        <span className="rail-qty mono">{qty[i.id]}×</span> {i.name}
                      </span>
                      <span className="rail-amt mono">
                        ${(qty[i.id] * i.price).toFixed(2)}
                      </span>
                    </li>
                )}
                </ul>
              }
              <div className="rail-totals">
                <div className="rail-row">
                  <span>Subtotal</span>
                  <span className="mono">${subtotal.toFixed(2)}</span>
                </div>
                <div className="rail-row">
                  <span>{mode === "delivery" ? "Delivery" : "Pickup"}</span>
                  <span className="mono" style={{ color: "var(--ink-500)" }}>
                    {mode === "delivery" ? "free" : "—"}
                  </span>
                </div>
                <div className="rail-row rail-row-total">
                  <span>Total</span>
                  <span className="mono">${subtotal.toFixed(2)}</span>
                </div>
              </div>
              <button
                className="btn btn-primary rail-submit"
                onClick={submit}
                disabled={lineCount === 0}>
                
                {submitted ? "Order placed — thanks." : "Submit order"}
              </button>
              <div className="rail-fine">
                Text Annabel to change anything · 216-202-5718
              </div>
            </div>
          </aside>
        </div>

        <footer className="page-foot">
          <div>Bay Branch Farm · 3612 W 114th St, Cleveland</div>
          <div className="mono" style={{ color: "var(--ink-500)" }}>order.baybranchfarm.com/c/k4f8x2</div>
        </footer>
      </div>

      {/* Sticky bottom bar — mobile only */}
      <div className={"sticky-bar" + (lineCount > 0 ? " is-active" : "")}>
        <div className="sticky-summary">
          <div className="sticky-count">{itemCount} item{itemCount !== 1 ? "s" : ""}</div>
          <div className="sticky-total mono">${subtotal.toFixed(2)}</div>
        </div>
        <button
          className="btn btn-primary sticky-btn"
          onClick={scrollToFulfill}
          disabled={lineCount === 0}>
          Review
        </button>
      </div>
    </div>);

}

window.OrderPage = OrderPage;