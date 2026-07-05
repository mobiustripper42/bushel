import { query } from "@/lib/db";
import { CustomersPage, type CustomerRow } from "@/components/admin/customers-page";

export default async function AdminCustomersPage() {
  // #61: fetch all customers (active + deactivated). Default view filters
  // to active client-side; the page-header toggle reveals the rest.
  // (Admin auth is enforced by the (admin) layout; data reads are
  // full-privilege pg per DEC-048.)
  let customers: CustomerRow[];
  try {
    customers = await query<CustomerRow>(
      `select id, name, business_name, email, phone, delivery_address,
              priority, send_weekly_link, token, is_active
         from customers
        order by is_active desc, priority asc, name asc`,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return (
      <main style={{ padding: "28px 32px", maxWidth: 1200 }}>
        <h1 className="page-title">Customers</h1>
        <p style={{ color: "var(--rose-600)", marginTop: 16 }}>{message}</p>
      </main>
    );
  }

  return <CustomersPage customers={customers} />;
}
