import { notFound, redirect } from "next/navigation";
import { AllSoldOutShell } from "@/components/customer/AllSoldOutShell";
import { ClosedShell } from "@/components/customer/ClosedShell";
import { OrderForm } from "@/components/customer/OrderForm";
import { PausedShell } from "@/components/customer/PausedShell";
import {
  getAvailableProducts,
  getCurrentWeekOrder,
  getLatestDeliveryPreference,
  getOrderingScheduleStatus,
} from "@/lib/customer/queries";
import { lookupCustomerByToken } from "@/lib/customer/session";
import { weekOfLabel, weekOfMondayNY } from "@/lib/week";

export default async function CustomerTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const customer = await lookupCustomerByToken(token);
  if (!customer) notFound();

  const greetingName = customer.business_name ?? customer.name;

  // #130 — account state shells. Deactivated customers (is_active=false)
  // see the "closed" copy; active-but-unsubscribed customers see the
  // "paused" copy. Both short-circuit the order form so a stale link
  // can't submit.
  if (!customer.is_active) {
    return <PausedShell customerName={greetingName} reason="closed" />;
  }
  if (!customer.send_weekly_link) {
    return <PausedShell customerName={greetingName} reason="paused" />;
  }

  // If this customer has already submitted an order for the current NY-time
  // week, the link is "your weekly order" — bounce to the confirmation rather
  // than re-showing the empty form. The server-side place_order RPC would
  // catch a re-submit either way, but seeing the empty form again is
  // confusing UX.
  const existingOrder = await getCurrentWeekOrder(customer.id, weekOfMondayNY());
  if (existingOrder) redirect(`/c/${token}/confirmed`);

  const [products, priorDeliveryPreference, schedule] = await Promise.all([
    getAvailableProducts(),
    getLatestDeliveryPreference(customer.id),
    getOrderingScheduleStatus(),
  ]);

  // DEC-031: four customer-side states keyed off ordering_schedule.is_open
  // and product inventory. Server-side `is_open` is a soft UI hint only;
  // submission enforcement remains DEC-012's job.
  if (!schedule.is_open) {
    return <ClosedShell customerName={greetingName} />;
  }

  // 6.5d: orderable means at least one active unit fits in current base
  // inventory. A product with only a conv=4 unit and qty_available=2 is
  // effectively sold out even though qty_available > 0.
  const anyOrderable = products.some((p) =>
    p.units.some((u) => p.qty_available >= u.conversion_to_base),
  );
  if (!anyOrderable) {
    return <AllSoldOutShell customerName={greetingName} />;
  }

  return (
    <OrderForm
      customer={{
        id: customer.id,
        name: greetingName,
        delivery_address: customer.delivery_address,
      }}
      products={products}
      priorDeliveryPreference={priorDeliveryPreference}
      weekLabel={weekOfLabel()}
    />
  );
}
