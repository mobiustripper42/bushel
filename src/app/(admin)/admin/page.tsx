export default function AdminPage() {
  return (
    <main style={{ padding: "32px 40px" }}>
      <div style={{ marginBottom: 8 }}>
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--leaf-600)",
          }}
        >
          dashboard
        </span>
      </div>
      <h1 style={{ fontSize: "2rem", fontWeight: 600, marginBottom: 24, color: "var(--ink-900)" }}>
        Bay Branch Farm
      </h1>
      <p style={{ color: "var(--ink-500)", fontSize: "0.95rem" }}>
        Use the sidebar to manage inventory, customers, and orders.
      </p>
    </main>
  );
}
