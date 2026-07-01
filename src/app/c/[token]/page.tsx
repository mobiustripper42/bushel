import { notFound, redirect } from "next/navigation";
import { AllSoldOutShell } from "@/components/customer/AllSoldOutShell";
import { ClosedShell } from "@/components/customer/ClosedShell";
import { OrderForm } from "@/components/customer/OrderForm";
import { PausedShell } from "@/components/customer/PausedShell";
import { isTerminalStatus } from "@/lib/admin/orders-queries";
import {
  anyOrderable,
  getAvailableProducts,
  getCurrentWeekOrder,
  getLatestDeliveryPreference,
  getOrderingScheduleStatus,
} from "@/lib/customer/queries";
import { lookupCustomerByToken } from "@/lib/customer/session";
import { weekOfLabel, weekOfMondayNY } from "@/lib/week";

export default async function CustomerTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ add?: string }>;
}) {
  const { token } = await params;
  const { add } = await searchParams;
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
  //
  // #211 / DEC-039: ?add=1 (the /confirmed hub's "Add to your order" link)
  // skips that bounce and renders the form in ADD MODE — new items append to
  // the existing order. A terminal order (picked-up/delivered) can't take
  // appends, so it bounces back to /confirmed, where the gated-off reason
  // copy lives.
  const existingOrder = await getCurrentWeekOrder(customer.id, weekOfMondayNY());
  const addMode = add === "1" && existingOrder !== null;
  if (existingOrder && !addMode) redirect(`/c/${token}/confirmed`);
  if (addMode && existingOrder && isTerminalStatus(existingOrder.status)) {
    redirect(`/c/${token}/confirmed`);
  }

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
  if (!anyOrderable(products)) {
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
      existingOrder={
        addMode && existingOrder
          ? {
              fulfillment_type: existingOrder.fulfillment_type,
              delivery_address: existingOrder.delivery_address,
              delivery_preference: existingOrder.delivery_preference,
              pickup_note: existingOrder.pickup_note,
              // 9.1/DEC-039 — the query already joins order_items; thread them
              // through so add mode shows the *complete* order (existing lines
              // read-only) above the new additions, not just what's being added.
              items: (existingOrder.order_items ?? []).map((it) => ({
                id: it.id,
                name: it.products?.name ?? "(item)",
                unitLabel: it.product_units?.label ?? "",
                qty: it.qty,
                unit_price_cents: it.unit_price_cents,
              })),
            }
          : null
      }
    />
  );
}
