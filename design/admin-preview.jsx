/* Admin order list surface preview (desktop) */

function AdminPreview() {
  const orders = [
    { id: "0421-03", customer: "Lake Road Market",  items: 8, total: 184.50, mode: "Delivery", window: "Wed AM",  status: "new" },
    { id: "0421-02", customer: "Edwins",            items: 4, total:  68.00, mode: "Delivery", window: "Wed AM",  status: "ready" },
    { id: "0421-01", customer: "Oxbow Orchard",     items: 12, total: 312.75, mode: "Delivery", window: "Wed PM", status: "ready", recon: true },
    { id: "0420-04", customer: "purplebrown",       items: 6, total: 142.00, mode: "Pickup",   window: "Thu 2-4", status: "new" },
    { id: "0420-03", customer: "Spice Kitchen",     items: 5, total:  88.25, mode: "Pickup",   window: "Thu 4-6", status: "delivered" },
    { id: "0420-02", customer: "Trentina",          items: 3, total:  54.00, mode: "Delivery", window: "Wed PM",  status: "delivered" },
  ];

  return (
    <div style={{ background: "var(--cream)", height: "100%", display: "flex", fontFamily: "var(--sans)", fontSize: 13 }}>
      {/* Sidebar */}
      <aside style={{ width: 200, background: "var(--paper)", borderRight: "1px solid var(--ink-200)", padding: "18px 14px", flexShrink: 0 }}>
        <div style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: "1.1rem", marginBottom: 2 }}>Bushel</div>
        <div style={{ fontSize: "0.72rem", color: "var(--ink-500)", marginBottom: 22 }}>Bay Branch Farm</div>

        <NavItem>Inventory</NavItem>
        <NavItem active>Orders</NavItem>
        <NavItem>Customers</NavItem>
        <NavItem>Send update</NavItem>
        <NavItem>Schedule</NavItem>

        <div style={{ marginTop: 28, padding: "10px 12px", background: "var(--leaf-50)", borderRadius: "var(--r-sm)", border: "1px solid var(--leaf-100)" }}>
          <div className="eyebrow" style={{ fontSize: "0.62rem", marginBottom: 4 }}>this week</div>
          <div style={{ fontWeight: 600 }}>Open</div>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-500)" }}>closes Tue 9:00pm</div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: "20px 28px", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>week of apr 27</div>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: "1.6rem" }}>Orders</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm">Export Wave CSV</button>
            <button className="btn btn-primary btn-sm">+ New order</button>
          </div>
        </div>

        {/* recon callout */}
        <div className="callout callout-warn" style={{ marginBottom: 16, fontSize: "0.85rem" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber-600)", marginTop: 7, flexShrink: 0 }} />
          <div>
            <strong>1 order needs reconciliation.</strong> Oxbow Orchard ordered 14 bunches of dino kale; 12 available. Text Annabel to confirm.
          </div>
        </div>

        {/* table */}
        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--leaf-50)" }}>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th align="right">Items</Th>
                <Th align="right">Total</Th>
                <Th>Mode</Th>
                <Th>Window</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ borderTop: "1px solid var(--ink-200)", background: o.recon ? "var(--amber-50)" : "transparent" }}>
                  <Td><span className="mono" style={{ color: "var(--ink-700)" }}>{o.id}</span></Td>
                  <Td><span style={{ fontWeight: 600 }}>{o.customer}</span></Td>
                  <Td align="right">{o.items}</Td>
                  <Td align="right"><span className="mono">${o.total.toFixed(2)}</span></Td>
                  <Td>{o.mode}</Td>
                  <Td>{o.window}</Td>
                  <Td>
                    {o.recon
                      ? <span className="badge badge-recon">Needs recon</span>
                      : o.status === "new"       ? <span className="badge badge-new">New</span>
                      : o.status === "ready"     ? <span className="badge badge-ready">Ready</span>
                      : <span className="badge badge-done">Delivered</span>
                    }
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function NavItem({ children, active }) {
  return (
    <div style={{
      padding: "8px 12px", borderRadius: "var(--r-sm)", marginBottom: 2, cursor: "pointer",
      fontWeight: active ? 600 : 400,
      background: active ? "var(--leaf-100)" : "transparent",
      color: active ? "var(--leaf-700)" : "var(--ink-700)"
    }}>{children}</div>
  );
}

function Th({ children, align }) {
  return <th style={{
    textAlign: align || "left", padding: "10px 14px",
    fontWeight: 600, fontSize: "0.68rem", letterSpacing: "0.06em", textTransform: "uppercase",
    color: "var(--leaf-700)"
  }}>{children}</th>;
}

function Td({ children, align }) {
  return <td style={{ padding: "11px 14px", textAlign: align || "left", fontSize: "0.86rem", color: "var(--ink-900)" }}>{children}</td>;
}

window.AdminPreview = AdminPreview;
