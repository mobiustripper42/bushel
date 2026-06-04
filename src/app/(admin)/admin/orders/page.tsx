import { OrdersPage } from "@/components/admin/orders-page";
import { currentWeekOf, listOrders } from "@/lib/admin/orders-queries";
import { getFulfillmentToken } from "@/lib/fulfillment/link";
import { shiftWeek } from "@/lib/week";

export const metadata = { title: "Orders — Bay Branch Farm" };

function resolveWeekFilter(raw: string | undefined): "this" | "last" {
  return raw === "last" ? "last" : "this";
}

export default async function OrdersRoute({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const weekFilter = resolveWeekFilter(params.week);
  const thisWeek = currentWeekOf();
  const lastWeek = shiftWeek(thisWeek, -1);
  const selectedWeek = weekFilter === "last" ? lastWeek : thisWeek;

  const [orders, thisWeekOrders, lastWeekOrders, harvestSheetToken] =
    await Promise.all([
      listOrders(selectedWeek),
      weekFilter === "this" ? Promise.resolve(null) : listOrders(thisWeek),
      weekFilter === "last" ? Promise.resolve(null) : listOrders(lastWeek),
      getFulfillmentToken(),
    ]);

  const thisWeekCount =
    weekFilter === "this" ? orders.length : (thisWeekOrders?.length ?? 0);
  const lastWeekCount =
    weekFilter === "last" ? orders.length : (lastWeekOrders?.length ?? 0);

  return (
    <OrdersPage
      orders={orders}
      weekFilter={weekFilter}
      weekOf={selectedWeek}
      thisWeekCount={thisWeekCount}
      lastWeekCount={lastWeekCount}
      harvestSheetToken={harvestSheetToken}
    />
  );
}
