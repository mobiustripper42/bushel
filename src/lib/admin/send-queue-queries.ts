// Send-queue reads (Phase 4.2). Service-role admin reads — these enumerate
// every customer in the system. RLS would also allow it (authenticated all-
// access), but we use service role for consistency with the rest of the
// admin queries.
import { createAdminClient } from "@/lib/supabase/admin";
import { weekOfMondayNY } from "@/lib/week";

export type SendMode =
  | "weekly_update"
  | "order_confirmation"
  | "pickup_reminder";

export const SEND_MODES: SendMode[] = [
  "weekly_update",
  "order_confirmation",
  "pickup_reminder",
];

export type SendQueueRow = {
  customerId: string;
  customerName: string;
  phone: string | null;
  token: string;
  priority: number;
  sentAt: string | null;
  fulfillmentType: "pickup" | "delivery" | null;
  pickupNote: string | null;
  deliveryPreference: string | null;
};

// Resolves the customer-facing token URL base. Prod is order.baybranchfarm.com;
// preview deployments use NEXT_PUBLIC_VERCEL_URL; local dev falls back to the
// dev port. The send-queue body lives in a deep link the operator will SEE
// before tapping send, so a wrong base URL would be obvious — fail open, not
// loud.
export function customerOrderBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  return "https://order.baybranchfarm.com";
}

export function tokenUrl(token: string): string {
  return `${customerOrderBaseUrl()}/c/${token}`;
}

// Loads `customer_sends` for the current week+mode into a customer-id-keyed
// map of `sent_at` ISO strings. Used to decorate each row with sent state.
async function loadSendStateMap(
  weekOf: string,
  mode: SendMode,
): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customer_sends")
    .select("customer_id, sent_at")
    .eq("week_of", weekOf)
    .eq("mode", mode);
  if (error) throw new Error(`loadSendStateMap: ${error.message}`);
  return new Map((data ?? []).map((r) => [r.customer_id, r.sent_at]));
}

// weekly_update queue: every active customer with send_weekly_link=true,
// priority desc.
export async function getWeeklyUpdateQueue(): Promise<SendQueueRow[]> {
  const supabase = createAdminClient();
  const weekOf = weekOfMondayNY();

  const [customersResult, sendMap] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, phone, token, priority")
      .eq("is_active", true)
      .eq("send_weekly_link", true)
      .order("priority", { ascending: false })
      .order("name", { ascending: true }),
    loadSendStateMap(weekOf, "weekly_update"),
  ]);

  if (customersResult.error)
    throw new Error(`getWeeklyUpdateQueue: ${customersResult.error.message}`);

  return (customersResult.data ?? []).map((c) => ({
    customerId: c.id,
    customerName: c.name,
    phone: c.phone,
    token: c.token,
    priority: c.priority,
    sentAt: sendMap.get(c.id) ?? null,
    fulfillmentType: null,
    pickupNote: null,
    deliveryPreference: null,
  }));
}

type OrderBoundMode = "order_confirmation" | "pickup_reminder";

// order_confirmation + pickup_reminder both queue from "customers with an
// order this week." Shared loader; mode only affects which customer_sends
// rows we lookup.
async function getOrderBoundQueue(
  mode: OrderBoundMode,
): Promise<SendQueueRow[]> {
  const supabase = createAdminClient();
  const weekOf = weekOfMondayNY();

  const [ordersResult, sendMap] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "customer_id, fulfillment_type, pickup_note, delivery_preference, customers(id, name, phone, token, priority)",
      )
      .eq("week_of", weekOf),
    loadSendStateMap(weekOf, mode),
  ]);

  if (ordersResult.error)
    throw new Error(`getOrderBoundQueue(${mode}): ${ordersResult.error.message}`);

  const rows: SendQueueRow[] = (ordersResult.data ?? [])
    .filter((o) => o.customers !== null)
    .map((o) => {
      const c = o.customers as {
        id: string;
        name: string;
        phone: string | null;
        token: string;
        priority: number;
      };
      // Narrow fulfillment_type at the boundary; anything outside the union
      // falls back to "pickup" (the conservative default) rather than the
      // delivery branch picking up garbage.
      const fulfillmentType: "pickup" | "delivery" =
        o.fulfillment_type === "delivery" ? "delivery" : "pickup";
      return {
        customerId: c.id,
        customerName: c.name,
        phone: c.phone,
        token: c.token,
        priority: c.priority,
        sentAt: sendMap.get(c.id) ?? null,
        fulfillmentType,
        pickupNote: o.pickup_note,
        deliveryPreference: o.delivery_preference,
      };
    });

  return rows.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.customerName.localeCompare(b.customerName);
  });
}

export async function getOrderConfirmationQueue(): Promise<SendQueueRow[]> {
  return getOrderBoundQueue("order_confirmation");
}

export async function getPickupReminderQueue(): Promise<SendQueueRow[]> {
  return getOrderBoundQueue("pickup_reminder");
}

// ordering_schedule is a singleton (DEC-030). Same .single() discipline as
// getOrderingOpen — loud failure if the row goes missing.
export async function getIntroNote(): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ordering_schedule")
    .select("intro_note")
    .single();
  if (error) throw new Error(`getIntroNote: ${error.message}`);
  return data.intro_note ?? "";
}

// Count of weekly_update unsent for the current week — used by the admin
// nav badge. Only weekly_update has a badge; order_confirmation and
// pickup_reminder are surfaced through the page's mode tabs instead, to
// keep the nav uncluttered when multiple modes have unsent customers.
// Runs on every admin page render via the layout, so we avoid the full
// queue load: count subscribers, subtract sent rows for the week.
export async function getWeeklyUpdateUnsentCount(): Promise<number> {
  const supabase = createAdminClient();
  const weekOf = weekOfMondayNY();

  const [subscribers, sent] = await Promise.all([
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("send_weekly_link", true),
    supabase
      .from("customer_sends")
      .select("customer_id", { count: "exact", head: true })
      .eq("week_of", weekOf)
      .eq("mode", "weekly_update"),
  ]);

  if (subscribers.error)
    throw new Error(`getWeeklyUpdateUnsentCount(subscribers): ${subscribers.error.message}`);
  if (sent.error)
    throw new Error(`getWeeklyUpdateUnsentCount(sent): ${sent.error.message}`);

  return Math.max(0, (subscribers.count ?? 0) - (sent.count ?? 0));
}
