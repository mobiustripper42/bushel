// Harvest & Pack Sheet rollup (#195, idea PR #194).
//
// Read-only derivation over the week's orders, regenerated on every view so a
// Tuesday-night oversell fix moves the totals and slips with it. Reuses
// listActiveOrders() — which already joins order_items → products → product_units —
// so there's no new query or RLS surface. The base-unit fold (qty ×
// conversion_to_base) is the same math place_order runs on decrement; we never
// sum raw qty across mixed units (3 bunches + 2 lb ≠ 5).
import { listActiveOrders } from "@/lib/admin/orders-queries";

export type HarvestUnit = { unit: string; qty: number };

export type HarvestProduct = {
  productId: string;
  name: string;
  base: string;
  units: HarvestUnit[];
  baseTotal: number;
  // Show the folded base total only when it adds information: more than one
  // ordered unit, or a single unit that isn't already the base unit.
  showTotal: boolean;
};

export type SlipLine = { qty: number; unit: string; product: string };

export type Slip = {
  orderId: string;
  customer: string;
  fulfillment: "pickup" | "delivery";
  where: string;
  lines: SlipLine[];
};

export type FulfillmentReport = {
  weekOf: string;
  orderCount: number;
  harvest: HarvestProduct[];
  slips: Slip[];
};

function round2(n: number): number {
  return Number(n.toFixed(2));
}

export async function buildFulfillmentReport(
  weekOf: string,
): Promise<FulfillmentReport> {
  // DEC-041/DEC-042 (#227): the sheet shows every OPEN order regardless of
  // week — an order that stays open across a week boundary keeps printing
  // until it's out the door. Fulfilled orders (picked_up/delivered) are
  // already excluded by the active-status query. weekOf survives only as the
  // sheet's display stamp.
  const orders = await listActiveOrders();

  // ── consolidated harvest list ──────────────────────────────────────────
  const byProduct = new Map<
    string,
    {
      name: string;
      base: string;
      units: Map<string, number>;
      convByUnit: Map<string, number>;
      baseTotal: number;
    }
  >();

  for (const order of orders) {
    for (const it of order.items) {
      let p = byProduct.get(it.productId);
      if (!p) {
        p = {
          name: it.name,
          base: it.unit,
          units: new Map(),
          convByUnit: new Map(),
          baseTotal: 0,
        };
        byProduct.set(it.productId, p);
      }
      p.units.set(it.unitLabel, (p.units.get(it.unitLabel) ?? 0) + it.qty);
      p.convByUnit.set(it.unitLabel, it.conversionToBase);
      p.baseTotal += it.qty * it.conversionToBase;
    }
  }

  const harvest: HarvestProduct[] = [...byProduct.entries()]
    .map(([productId, p]) => {
      const units = [...p.units.entries()].map(([unit, qty]) => ({
        unit,
        qty: round2(qty),
      }));
      const single = units.length === 1;
      const onlyConv = single ? p.convByUnit.get(units[0].unit) : null;
      const showTotal = !single || onlyConv !== 1;
      return {
        productId,
        name: p.name,
        base: p.base,
        units,
        baseTotal: round2(p.baseTotal),
        showTotal,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── per-customer packing slips ─────────────────────────────────────────
  const slips: Slip[] = orders
    .map((o) => ({
      orderId: o.id,
      customer: o.customerName,
      fulfillment: o.fulfillmentType,
      where:
        o.fulfillmentType === "delivery"
          ? (o.deliveryAddress ?? o.deliveryPreference ?? "Delivery")
          : (o.pickupNote ?? "Farm pickup"),
      lines: o.items.map((it) => ({
        qty: round2(it.qty),
        unit: it.unitLabel,
        product: it.name,
      })),
    }))
    .sort((a, b) => a.customer.localeCompare(b.customer));

  return { weekOf, orderCount: orders.length, harvest, slips };
}
