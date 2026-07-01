import { OrdersPage } from "@/components/admin/orders-page";
import {
  currentWeekOf,
  listActiveOrders,
  listFulfilledOrders,
} from "@/lib/admin/orders-queries";
import { getFulfillmentToken } from "@/lib/fulfillment/link";

export const metadata = { title: "Orders — Bay Branch Farm" };

// DEC-045 (#231): orders are no longer week-aligned (DEC-041), so the list
// keys on status, not week — Active (non-terminal, any week) by default,
// Fulfilled (the browsable past) behind the second tab.
function resolveView(raw: string | undefined): "active" | "fulfilled" {
  return raw === "fulfilled" ? "fulfilled" : "active";
}

export default async function OrdersRoute({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const view = resolveView(params.view);

  // Both lists fetched so the tab counts are always live. Fine at this
  // scale (single-digit customers, weekly cadence); revisit with pagination
  // if Fulfilled ever grows past a few hundred rows.
  const [activeOrders, fulfilledOrders, harvestSheetToken] = await Promise.all([
    listActiveOrders(),
    listFulfilledOrders(),
    getFulfillmentToken(),
  ]);

  return (
    <OrdersPage
      orders={view === "active" ? activeOrders : fulfilledOrders}
      view={view}
      weekOf={currentWeekOf()}
      activeCount={activeOrders.length}
      fulfilledCount={fulfilledOrders.length}
      harvestSheetToken={harvestSheetToken}
    />
  );
}
