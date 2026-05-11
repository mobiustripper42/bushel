import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CustomerActiveToggle } from "@/components/admin/customer-active-toggle";

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

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--ink-100)",
  fontSize: "0.9rem",
  color: "var(--ink-900)",
};

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: customers, error } = await supabase
    .from("customers")
    .select("*")
    .order("priority", { ascending: true })
    .order("name");

  return (
    <main style={{ padding: "32px 40px", maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "var(--ink-900)",
            margin: 0,
          }}
        >
          Customers
        </h1>
        <Link
          href="/admin/customers/new"
          style={{
            padding: "8px 16px",
            fontSize: "0.85rem",
            fontWeight: 600,
            background: "var(--leaf-600)",
            color: "var(--paper)",
            borderRadius: "var(--r-sm)",
            textDecoration: "none",
          }}
        >
          + New customer
        </Link>
      </div>

      {error && <p style={{ color: "var(--destructive)", marginBottom: 16 }}>{error.message}</p>}

      {!error && (!customers || customers.length === 0) && (
        <p style={{ color: "var(--ink-500)" }}>No customers yet.</p>
      )}

      {customers && customers.length > 0 && (
        <div style={{ overflowX: "auto" }}>
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
                <th style={thStyle}>Business</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Phone</th>
                <th style={thStyle}>Priority</th>
                <th style={thStyle}>Send link</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}><span style={{ position: "absolute", left: -9999 }}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.55 }}>
                  <td style={tdStyle}>
                    <Link href={`/admin/customers/${c.id}`} style={{ color: "var(--ink-900)", fontWeight: 500 }}>
                      {c.name}
                    </Link>
                  </td>
                  <td style={tdStyle}>{c.business_name ?? ""}</td>
                  <td style={tdStyle}>{c.email ?? ""}</td>
                  <td style={tdStyle}>{c.phone ?? ""}</td>
                  <td style={tdStyle}>{c.priority}</td>
                  <td style={tdStyle}>{c.send_weekly_link ? "Yes" : "No"}</td>
                  <td style={tdStyle}>{c.is_active ? "Active" : "Inactive"}</td>
                  <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                    <CustomerActiveToggle id={c.id} isActive={c.is_active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
