/* Customer order surface preview (mobile) */
const { useState } = React;

function CustomerPreview() {
  const [qty, setQty] = useState({ kale: 4, beets: 0, lettuce: 2, flowers: 1 });
  const [mode, setMode] = useState("delivery");

  const items = [
    { id: "kale",    name: "Dino kale",        unit: "bunch",  price: 4.50, avail: 18 },
    { id: "beets",   name: "Red beets",        unit: "lb",     price: 3.25, avail: 22 },
    { id: "lettuce", name: "Salanova mix",     unit: "head",   price: 5.00, avail: 9 },
    { id: "flowers", name: "Mixed bouquet",    unit: "stem",   price: 12.00, avail: 6 },
  ];
  const total = items.reduce((s, i) => s + (qty[i.id] || 0) * i.price, 0);
  const itemCount = items.reduce((s, i) => s + (qty[i.id] || 0), 0);

  const setN = (id, n) => setQty(q => ({ ...q, [id]: Math.max(0, n) }));

  return (
    <div style={{ background: "var(--cream)", minHeight: "100%", padding: "20px 18px 96px", fontFamily: "var(--sans)" }}>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>this week · may 2</div>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: "1.75rem", lineHeight: 1.15, marginBottom: 4 }}>What's available</h1>
        <p style={{ color: "var(--ink-500)", fontSize: "0.95rem" }}>
          Order by Tuesday 9pm. Pickup or delivery Wednesday.
        </p>
      </div>

      {/* Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
        {items.map(i => (
          <div key={i.id} className="card" style={{ padding: "14px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 8, background: "var(--leaf-50)",
              border: "1px solid var(--leaf-100)", flexShrink: 0
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "0.98rem", color: "var(--ink-900)" }}>{i.name}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--ink-500)" }}>
                ${i.price.toFixed(2)} / {i.unit} · {i.avail} {i.unit}{i.avail !== 1 ? "s" : ""} left
              </div>
            </div>
            <Stepper value={qty[i.id]} onChange={n => setN(i.id, n)} />
          </div>
        ))}
      </div>

      {/* Fulfillment */}
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>fulfillment</div>
        <div style={{ display: "flex", gap: 8 }}>
          <SegBtn active={mode === "delivery"} onClick={() => setMode("delivery")}>Delivery</SegBtn>
          <SegBtn active={mode === "pickup"} onClick={() => setMode("pickup")}>Pickup</SegBtn>
        </div>
      </div>

      {/* Sticky-style total */}
      <div style={{
        position: "sticky", bottom: 0, marginLeft: -18, marginRight: -18,
        padding: "14px 18px 16px", background: "var(--paper)", borderTop: "1px solid var(--ink-200)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div style={{ fontSize: "0.82rem", color: "var(--ink-500)" }}>{itemCount} item{itemCount !== 1 ? "s" : ""}</div>
          <div style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", fontWeight: 600 }}>${total.toFixed(2)}</div>
        </div>
        <button className="btn btn-primary" style={{ width: "100%" }}>Place order</button>
      </div>
    </div>
  );
}

function Stepper({ value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--ink-300)", borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--paper)" }}>
      <button
        onClick={() => onChange(value - 1)}
        disabled={!value}
        style={{
          width: 32, height: 32, border: "none", background: "transparent",
          color: value ? "var(--leaf-700)" : "var(--ink-300)",
          fontSize: "1.1rem", cursor: value ? "pointer" : "default", fontWeight: 600
        }}
      >−</button>
      <div style={{
        width: 28, textAlign: "center", fontVariantNumeric: "tabular-nums",
        fontWeight: 600, fontSize: "0.95rem", color: value ? "var(--ink-900)" : "var(--ink-500)"
      }}>{value || 0}</div>
      <button
        onClick={() => onChange(value + 1)}
        style={{ width: 32, height: 32, border: "none", background: "transparent", color: "var(--leaf-700)", fontSize: "1.1rem", cursor: "pointer", fontWeight: 600 }}
      >+</button>
    </div>
  );
}

function SegBtn({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "10px 14px", borderRadius: "var(--r-sm)",
        border: `1px solid ${active ? "var(--leaf-600)" : "var(--ink-300)"}`,
        background: active ? "var(--leaf-50)" : "var(--paper)",
        color: active ? "var(--leaf-700)" : "var(--ink-700)",
        fontWeight: 600, fontSize: "0.92rem", cursor: "pointer", fontFamily: "var(--sans)",
        minHeight: 44
      }}
    >{children}</button>
  );
}

window.CustomerPreview = CustomerPreview;
