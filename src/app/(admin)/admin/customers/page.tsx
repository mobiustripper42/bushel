import { createClient } from "@/lib/supabase/server";
import { CustomersPage, type CustomerRow } from "@/components/admin/customers-page";

export default async function AdminCustomersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, business_name, email, phone, delivery_address, priority, send_weekly_link, token")
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return (
      <main style={{ padding: "28px 32px", maxWidth: 1200 }}>
        <h1 className="page-title">Customers</h1>
        <p style={{ color: "var(--rose-600)", marginTop: 16 }}>{error.message}</p>
      </main>
    );
  }

  const customers: CustomerRow[] = data ?? [];
  return <CustomersPage customers={customers} />;
}
