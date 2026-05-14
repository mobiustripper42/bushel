import { notFound } from "next/navigation";
import { OrderForm } from "@/components/customer/OrderForm";
import {
  getAvailableProducts,
  getLatestDeliveryPreference,
} from "@/lib/customer/queries";
import { lookupCustomerByToken } from "@/lib/customer/session";
import { weekOfLabel } from "@/lib/week";

export default async function CustomerTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const customer = await lookupCustomerByToken(token);
  if (!customer) notFound();

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
