import { notFound, redirect } from "next/navigation";
import { OrderForm } from "@/components/customer/OrderForm";
import {
  getAvailableProducts,
  getCurrentWeekOrder,
  getLatestDeliveryPreference,
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

  // If this customer has already submitted an order for the current NY-time
  // week, the link is "your weekly order" — bounce to the confirmation rather
  // than re-showing the empty form. The server-side place_order RPC would
  // catch a re-submit either way, but seeing the empty form again is
  // confusing UX.
  const existingOrder = await getCurrentWeekOrder(customer.id, weekOfMondayNY());
  if (existingOrder) redirect(`/c/${token}/confirmed`);

  const [products, priorDeliveryPreference] = await Promise.all([
    getAvailableProducts(),
    getLatestDeliveryPreference(customer.id),
  ]);

  return (
    <OrderForm
      customer={{
        id: customer.id,
        name: customer.business_name ?? customer.name,
        delivery_address: customer.delivery_address,
      }}
      products={products}
      priorDeliveryPreference={priorDeliveryPreference}
      weekLabel={weekOfLabel()}
    />
  );
}
