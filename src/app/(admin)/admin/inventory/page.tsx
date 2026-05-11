import { createClient } from "@/lib/supabase/server";
import { InventoryRow } from "@/components/admin/inventory-row";

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: "0.72rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--ink-500)",
  borderBottom: "2px solid var(--ink-100)",
  whiteSpace: "nowrap",
};

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name");

  return (
    <main style={{ padding: "32px 40px", maxWidth: 960 }}>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.5rem",
          fontWeight: 600,
          color: "var(--ink-900)",
          marginBottom: 24,
        }}
      >
        Inventory
      </h1>

      {error && (
        <p style={{ color: "var(--destructive)", marginBottom: 16 }}>{error.message}</p>
      )}

      {!error && (!products || products.length === 0) && (
        <p style={{ color: "var(--ink-500)" }}>No products yet.</p>
      )}

      {products && products.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <style>{`
            .inv-input:hover { border-color: var(--ink-200) !important; }
            .inv-input:focus { outline: none; border-color: var(--leaf-500) !important; background: var(--paper) !important; }
          `}</style>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "var(--paper)",
              borderRadius: "var(--r-lg)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              overflow: "hidden",
            }}
          >
            <thead>
              <tr style={{ background: "var(--ink-50)" }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Unit</th>
                <th style={thStyle}>Price ($)</th>
                <th style={thStyle}>Qty Avail</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Available</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <InventoryRow key={product.id} product={product} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
