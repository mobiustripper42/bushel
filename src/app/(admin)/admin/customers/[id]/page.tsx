import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm } from "@/components/admin/customer-form";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: customer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !customer) notFound();

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
          marginBottom: 4,
        }}
      >
        {customer.name}
      </h1>
      <p style={{ fontSize: "0.82rem", color: "var(--ink-500)", marginBottom: 24 }}>
        Token: <code style={{ fontFamily: "var(--font-mono)" }}>{customer.token}</code>
      </p>
      <CustomerForm customer={customer} />
    </main>
  );
}
