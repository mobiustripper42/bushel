// Admin order-list reads (Phase 5.1). Full-privilege pg reads — admin only.
// The pure order-status domain (types, status sets, transition rules) lives
// in order-status.ts so client components can import it without dragging pg
// into the browser bundle; re-exported here for server-side callers.
import { consolidateItems, consolidationKey } from "@/lib/order-items";
import { query } from "@/lib/db";
import {
  OPEN_ORDER_STATUSES,
  ORDER_STATUSES,
  TERMINAL_ORDER_STATUSES,
  type OrderItem,
  type OrderRow,
  type OrderStatus,
} from "@/lib/admin/order-status";
import { weekOfMondayNY } from "@/lib/week";

export * from "@/lib/admin/order-status";

function narrowStatus(s: string): OrderStatus {
  return (ORDER_STATUSES as string[]).includes(s) ? (s as OrderStatus) : "new";
}

function narrowFulfillment(s: string): "pickup" | "delivery" {
  return s === "delivery" ? "delivery" : "pickup";
}

export function currentWeekOf(): string {
  return weekOfMondayNY();
}

// Orders joined with customer + items + products, sorted at the DB by
// created_at desc; reconciliation pinning is applied in the UI so it
// survives column-sort changes. DEC-045 dropped the week-keyed listOrders —
// the two status-keyed views below are the only entry points.
//
// DEC-041/DEC-042 (#227): every open (non-terminal) order regardless of week.
// The fulfillment sheet and the admin orders list's default view (DEC-045)
// read this — an order that stays open across a week boundary must stay
// visible until it's out the door.
export async function listActiveOrders(): Promise<OrderRow[]> {
  return queryOrders({ activeOnly: true });
}

// DEC-045 (#231): the browsable past — terminal orders persist as rows under
// the open-order model (nothing deletes them), newest first via the shared
// created_at sort.
export async function listFulfilledOrders(): Promise<OrderRow[]> {
  return queryOrders({ terminalOnly: true });
}

// Bare row counts for the orders-page tab chips — the view NOT being
// displayed only needs its number, not the full joined fetch (Fulfilled
// grows without bound; its full fetch shouldn't ride along on every
// Active-view load).
export async function countOrdersByStatus(
  statuses: OrderStatus[],
): Promise<number> {
  const rows = await query<{ count: number }>(
    `select count(*)::int as count from orders where status = any($1)`,
    [statuses],
  );
  return rows[0].count;
}

// Row shape the SQL below builds — mirrors the old PostgREST embed so the
// mapping code beneath is unchanged.
type QueryOrdersRow = {
  id: string;
  customer_id: string;
  created_at: string;
  week_of: string;
  fulfillment_type: string;
  delivery_address: string | null;
  delivery_preference: string | null;
  pickup_note: string | null;
  notes: string | null;
  status: string;
  needs_reconciliation: boolean;
  customers: { id: string; name: string; phone: string | null } | null;
  order_items: Array<{
    product_id: string;
    qty: number;
    unit_price_cents: number;
    products: {
      name: string;
      qty_available: number;
      product_units: Array<{ label: string; conversion_to_base: number }>;
    } | null;
    product_units: {
      label: string;
      conversion_to_base: number;
      sku: string | null;
      slug: string | null;
    } | null;
  }>;
};

async function queryOrders(filter: {
  weekOf?: string;
  activeOnly?: boolean;
  terminalOnly?: boolean;
}): Promise<OrderRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.weekOf) {
    params.push(filter.weekOf);
    where.push(`o.week_of = $${params.length}`);
  }
  if (filter.activeOnly) {
    params.push(OPEN_ORDER_STATUSES);
    where.push(`o.status = any($${params.length})`);
  }
  if (filter.terminalOnly) {
    params.push(TERMINAL_ORDER_STATUSES);
    where.push(`o.status = any($${params.length})`);
  }

  const data = await query<QueryOrdersRow>(
    `select o.id, o.customer_id, o.created_at, o.week_of, o.fulfillment_type,
            o.delivery_address, o.delivery_preference, o.pickup_note, o.notes,
            o.status, o.needs_reconciliation,
            json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) as customers,
            coalesce(
              json_agg(
                json_build_object(
                  'product_id', oi.product_id,
                  'qty', oi.qty,
                  'unit_price_cents', oi.unit_price_cents,
                  'products', case when pr.id is null then null else json_build_object(
                    'name', pr.name,
                    'qty_available', pr.qty_available,
                    'product_units', coalesce(
                      (select json_agg(json_build_object(
                                'label', u.label,
                                'conversion_to_base', u.conversion_to_base))
                         from product_units u where u.product_id = pr.id),
                      '[]')
                  ) end,
                  'product_units', case when pu.id is null then null else json_build_object(
                    'label', pu.label,
                    'conversion_to_base', pu.conversion_to_base,
                    'sku', pu.sku,
                    'slug', pu.slug
                  ) end
                )
                order by oi.created_at
              ) filter (where oi.id is not null),
              '[]'
            ) as order_items
       from orders o
       join customers c on c.id = o.customer_id
       left join order_items oi on oi.order_id = o.id
       left join products pr on pr.id = oi.product_id
       left join product_units pu on pu.id = oi.product_unit_id
      ${where.length ? `where ${where.join(" and ")}` : ""}
      group by o.id, c.id
      order by o.created_at desc`,
    params,
  );

  // customer_sends stays week-keyed (DEC-042), so the Send state for each
  // order is the send row of the order's OWN week_of stamp. Fetched after the
  // orders because the active view can span weeks — the sends lookup needs
  // the set of weeks actually present.
  const weeks = [...new Set(data.map((o) => o.week_of))];
  const sendsRows =
    weeks.length === 0
      ? []
      : await query<{
          customer_id: string;
          week_of: string;
          mode: string;
          sent_at: string;
        }>(
          `select customer_id, week_of, mode, sent_at
             from customer_sends where week_of = any($1)`,
          [weeks],
        );

  // Reminder mode is per-fulfillment (#193): pickup orders use pickup_reminder,
  // delivery orders use delivery_reminder — tracked separately, resolved per
  // order below.
  type SentEntry = {
    confirm: string | null;
    pickupReminder: string | null;
    deliveryReminder: string | null;
  };
  // Keyed (customer_id, week_of): with the active view spanning weeks, one
  // customer can appear with sends in more than one week — the old per-
  // customer key silently merged them.
  const sentByCustomerWeek = new Map<string, SentEntry>();
  for (const s of sendsRows) {
    const key = `${s.customer_id}:${s.week_of}`;
    const entry = sentByCustomerWeek.get(key) ?? {
      confirm: null,
      pickupReminder: null,
      deliveryReminder: null,
    };
    if (s.mode === "order_confirmation") entry.confirm = s.sent_at;
    else if (s.mode === "pickup_reminder") entry.pickupReminder = s.sent_at;
    else if (s.mode === "delivery_reminder") entry.deliveryReminder = s.sent_at;
    sentByCustomerWeek.set(key, entry);
  }

  return data
    .filter((o) => o.customers !== null)
    .map((o) => {
      const c = o.customers!;
      const sent = sentByCustomerWeek.get(`${c.id}:${o.week_of}`) ?? {
        confirm: null,
        pickupReminder: null,
        deliveryReminder: null,
      };
      const fulfillmentType = narrowFulfillment(o.fulfillment_type);
      const items: OrderItem[] = o.order_items
        .filter((i) => i.products !== null)
        .map((i) => {
          // DEC-037: the product-level unit is the base product_units row.
          const baseLabel = (i.products!.product_units ?? []).find(
            (u) => Number(u.conversion_to_base) === 1,
          )?.label;
          // Per-line unit label from the order line's product_units join
          // (6.5f). The base label is the fallback; both missing means the
          // unit row was deleted out from under the order — render blank
          // rather than invent a unit.
          const unitLabel = i.product_units?.label ?? baseLabel ?? "";
          return {
            productId: i.product_id,
            name: i.products!.name,
            sku: i.product_units?.sku ?? null,
            slug: i.product_units?.slug ?? null,
            unit: baseLabel ?? unitLabel,
            unitLabel,
            conversionToBase: Number(i.product_units?.conversion_to_base ?? 1),
            qty: i.qty,
            unitPriceCents: i.unit_price_cents,
            qtyAvailable: i.products!.qty_available,
          };
        });
      // #241: appends land as separate rows per submission — fold same
      // (product, unit, price) into one line here so every consumer of
      // OrderRow (detail panel, items preview, packing slips, Wave export)
      // renders the consolidated order.
      const consolidated = consolidateItems(items, (i) =>
        consolidationKey(i.productId, i.unitLabel, i.unitPriceCents),
      );
      const totalCents = consolidated.reduce(
        (s, i) => s + i.qty * i.unitPriceCents,
        0,
      );
      return {
        id: o.id,
        customerId: c.id,
        customerName: c.name,
        phone: c.phone,
        placedAt: o.created_at,
        weekOf: o.week_of,
        fulfillmentType,
        deliveryAddress: o.delivery_address,
        deliveryPreference: o.delivery_preference,
        pickupNote: o.pickup_note,
        notes: o.notes,
        status: narrowStatus(o.status),
        needsReconciliation: o.needs_reconciliation,
        items: consolidated,
        totalCents,
        confirmSentAt: sent.confirm,
        reminderSentAt:
          fulfillmentType === "pickup"
            ? sent.pickupReminder
            : sent.deliveryReminder,
      };
    });
}
