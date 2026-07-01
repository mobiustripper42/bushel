import { notFound, redirect } from "next/navigation";
import { AllSoldOutShell } from "@/components/customer/AllSoldOutShell";
import { ClosedShell } from "@/components/customer/ClosedShell";
import { OrderForm } from "@/components/customer/OrderForm";
import { PausedShell } from "@/components/customer/PausedShell";
import {
  anyOrderable,
  getAvailableProducts,
  getLatestDeliveryPreference,
  getOpenOrder,
  getOrderingScheduleStatus,
} from "@/lib/customer/queries";
import { lookupCustomerByToken } from "@/lib/customer/session";
import { consolidateItems } from "@/lib/order-items";
import { weekOfLabel } from "@/lib/week";

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

  // DEC-041/DEC-042 (#227): the customer's link renders their OPEN order
  // editable — the form comes up pre-populated in add mode (existing lines
  // read-only, new items append). No open order (none yet, or the last one
  // was fulfilled — picked_up/delivered drop out of the open-order identity)
  // means a fresh form: a new order is allowed the moment the box goes out.
  // The old bounce-to-/confirmed and its ?add=1 escape hatch are gone; stale
  // ?add=1 links land here and get the same editable view.
  const existingOrder = await getOpenOrder(customer.id);

  const [products, priorDeliveryPreference, schedule] = await Promise.all([
    getAvailableProducts(),
    getLatestDeliveryPreference(customer.id),
    getOrderingScheduleStatus(),
  ]);

  // DEC-031: four customer-side states keyed off ordering_schedule.is_open
  // and product inventory. Server-side `is_open` is a soft UI hint only;
  // submission enforcement remains DEC-012's job.
  //
  // With an open order, the closed/sold-out shells must not eat it — the
  // link is "your order" (DEC-041), so when the form can't render, the
  // receipt at /confirmed is the right view, not a dead-end shell.
  if (!schedule.is_open) {
    if (existingOrder) redirect(`/c/${token}/confirmed`);
    return <ClosedShell customerName={greetingName} />;
  }

  // 6.5d: orderable means at least one active unit fits in current base
  // inventory. A product with only a conv=4 unit and qty_available=2 is
  // effectively sold out even though qty_available > 0.
  if (!anyOrderable(products)) {
    if (existingOrder) redirect(`/c/${token}/confirmed`);
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
        existingOrder
          ? {
              fulfillment_type: existingOrder.fulfillment_type,
              delivery_address: existingOrder.delivery_address,
              delivery_preference: existingOrder.delivery_preference,
              pickup_note: existingOrder.pickup_note,
              // 9.1/DEC-039 — the query already joins order_items; thread them
              // through so add mode shows the *complete* order (existing lines
              // read-only) above the new additions, not just what's being added.
              // #241: consolidated — same (product, unit, price) reads as one
              // line no matter how many submissions built it.
              items: consolidateItems(
                existingOrder.order_items ?? [],
                (it) =>
                  `${it.product_id}|${it.product_units?.label ?? ""}|${it.unit_price_cents}`,
              ).map((it) => ({
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
