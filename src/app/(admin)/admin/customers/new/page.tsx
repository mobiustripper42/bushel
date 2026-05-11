import Link from "next/link";
import { CustomerForm } from "@/components/admin/customer-form";

export default function NewCustomerPage() {
  return (
    <main style={{ padding: "32px 40px", maxWidth: 900 }}>
      <div style={{ marginBottom: 8 }}>
        <Link href="/admin/customers" style={{ fontSize: "0.82rem", color: "var(--ink-500)", textDecoration: "none" }}>
          ← Customers
        </Link>
      </div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.5rem",
          fontWeight: 600,
          color: "var(--ink-900)",
          marginBottom: 24,
        }}
      >
        New customer
      </h1>
      <CustomerForm />
    </main>
  );
}
