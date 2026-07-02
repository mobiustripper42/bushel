import { OrdersPage } from "@/components/admin/orders-page";
import {
  OPEN_ORDER_STATUSES,
  TERMINAL_ORDER_STATUSES,
  countOrdersByStatus,
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

  // Full fetch for the displayed view only; the other tab just needs its
  // count (Fulfilled grows without bound — its joined fetch shouldn't ride
  // along on every Active-view load).
  const [orders, otherCount, harvestSheetToken] = await Promise.all([
    view === "active" ? listActiveOrders() : listFulfilledOrders(),
    countOrdersByStatus(
      view === "active" ? TERMINAL_ORDER_STATUSES : OPEN_ORDER_STATUSES,
    ),
    getFulfillmentToken(),
  ]);

  return (
    <OrdersPage
      orders={orders}
      view={view}
      weekOf={currentWeekOf()}
      activeCount={view === "active" ? orders.length : otherCount}
      fulfilledCount={view === "fulfilled" ? orders.length : otherCount}
      harvestSheetToken={harvestSheetToken}
    />
  );
}
