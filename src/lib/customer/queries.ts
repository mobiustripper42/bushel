// Customer-side reads. The token in the bbf_customer_token cookie is the
// authentication boundary; once it resolves to a customer row, these queries
// run with full DB privilege by design (DEC-048 — the service layer IS the
// access boundary).
import { OPEN_ORDER_STATUSES } from "@/lib/admin/order-status";
import { query, queryOne } from "@/lib/db";
import type { ProductUnitRow } from "@/lib/db-types";
import type { ProductRow as BaseProductRow } from "@/lib/db-types";

export type { ProductUnitRow };
export type ProductRow = BaseProductRow & {
  // Active units only, sorted by (sort_order nulls last, created_at). The base
  // unit (conversion_to_base = 1) is the implicit default for the customer
  // picker. 6.5a guarantees every product has at least one active unit.
  units: ProductUnitRow[];
};

export async function getAvailableProducts(): Promise<ProductRow[]> {
  // Units are aggregated (active only, picker order) in SQL — the JSON path
  // delivers numerics as numbers and timestamps as ISO strings already.
  return query<ProductRow>(
    `select p.*,
            coalesce(
              (select json_agg(to_json(pu) order by pu.sort_order nulls last, pu.created_at)
                 from product_units pu
                where pu.product_id = p.id and pu.is_active),
              '[]'
            ) as units
       from products p
      where p.is_active and p.is_available
      order by p.sort_order asc`,
  );
}

// 6.5d: orderable means at least one active unit fits in current base
// inventory. A product with only a conv=4 unit and qty_available=2 is
// effectively sold out even though qty_available > 0. Shared by /c/[token]
// (all-sold-out shell, DEC-031) and /c/[token]/confirmed (gates the
// "Add to your order" affordance, DEC-039) so the two can't drift.
export function anyOrderable(products: ProductRow[]): boolean {
  return products.some((p) =>
    p.units.some((u) => p.qty_available >= u.conversion_to_base),
  );
}

// Reads the ordering_schedule singleton. Customer page uses this to decide
// between the open form, the manual-closed shell, and the all-sold-out shell
// (DEC-031). DEC-030 guarantees a single row exists — queryOne lets a
// missing row surface as a real error rather than silently defaulting.
export async function getOrderingScheduleStatus(): Promise<{ is_open: boolean }> {
  return queryOne<{ is_open: boolean }>(
    "getOrderingScheduleStatus",
    `select is_open from ordering_schedule`,
  );
}

export async function getLatestDeliveryPreference(
  customerId: string,
): Promise<string | null> {
  const rows = await query<{ delivery_preference: string }>(
    `select delivery_preference
       from orders
      where customer_id = $1
        and fulfillment_type = 'delivery'
        and delivery_preference is not null
      order by created_at desc
      limit 1`,
    [customerId],
  );
  return rows[0]?.delivery_preference ?? null;
}

// Shared shape for the customer-facing order reads: line items + product
// names + per-line unit labels (product_units, DEC-037). Field names mirror
// the old PostgREST embed so consumers are unchanged.
export type CustomerOrder = {
  id: string;
  week_of: string;
  fulfillment_type: string;
  delivery_address: string | null;
  delivery_preference: string | null;
  pickup_note: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  order_items: Array<{
    id: string;
    product_id: string;
    qty: number;
    unit_price_cents: number;
    products: { name: string } | null;
    product_units: { label: string } | null;
  }>;
};

const CUSTOMER_ORDER_SELECT = `
  select o.id, o.week_of, o.fulfillment_type, o.delivery_address,
         o.delivery_preference, o.pickup_note, o.notes, o.status, o.created_at,
         coalesce(
           json_agg(
             json_build_object(
               'id', oi.id,
               'product_id', oi.product_id,
               'qty', oi.qty,
               'unit_price_cents', oi.unit_price_cents,
               'products', case when pr.id is null then null
                                else json_build_object('name', pr.name) end,
               'product_units', case when pu.id is null then null
                                     else json_build_object('label', pu.label) end
             )
             order by oi.created_at
           ) filter (where oi.id is not null),
           '[]'
         ) as order_items
    from orders o
    left join order_items oi on oi.order_id = o.id
    left join products pr on pr.id = oi.product_id
    left join product_units pu on pu.id = oi.product_unit_id
`;

// DEC-041 (#227): the customer's OPEN order — the one non-terminal order the
// partial unique index guarantees (at most one of new/confirmed/ready).
// Replaces the week-keyed getCurrentWeekOrder: identity is the open order,
// week_of is just a stamp. /c/[token] renders this order editable
// (pre-populated add mode); null means the customer is free to start fresh.
export async function getOpenOrder(
  customerId: string,
): Promise<CustomerOrder | null> {
  const rows = await query<CustomerOrder>(
    `${CUSTOMER_ORDER_SELECT}
     where o.customer_id = $1 and o.status = any($2)
     group by o.id`,
    [customerId, OPEN_ORDER_STATUSES],
  );
  // The partial unique index guarantees at most one open order; 2+ rows means
  // the invariant is broken — fail loud (same discipline .maybeSingle() had)
  // rather than silently picking one.
  if (rows.length > 1) {
    throw new Error(
      `getOpenOrder: ${rows.length} open orders for customer ${customerId} — orders_one_open_per_customer invariant violated`,
    );
  }
  return rows[0] ?? null;
}

// The customer's most recent order in ANY status. /confirmed renders this as
// the receipt: an open order gets the add affordance, a terminal one renders
// read-only with a "place a new order" path (DEC-042 — orders are only ever
// created open and move forward, so the newest row is the open order
// whenever one exists).
export async function getLatestOrder(
  customerId: string,
): Promise<CustomerOrder | null> {
  const rows = await query<CustomerOrder>(
    `${CUSTOMER_ORDER_SELECT}
     where o.customer_id = $1
     group by o.id
     order by o.created_at desc
     limit 1`,
    [customerId],
  );
  return rows[0] ?? null;
}
