// Send-queue reads (Phase 4.2). Full-privilege admin reads — these enumerate
// every customer in the system. Server-only.
import { query, queryOne } from "@/lib/db";
import { weekOfMondayNY } from "@/lib/week";

export type SendMode =
  | "weekly_update"
  | "order_confirmation"
  | "pickup_reminder"
  | "delivery_reminder";

export const SEND_MODES: SendMode[] = [
  "weekly_update",
  "order_confirmation",
  "pickup_reminder",
  "delivery_reminder",
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
  const rows = await query<{ customer_id: string; sent_at: string }>(
    `select customer_id, sent_at from customer_sends
      where week_of = $1 and mode = $2`,
    [weekOf, mode],
  );
  return new Map(rows.map((r) => [r.customer_id, r.sent_at]));
}

// weekly_update queue: every active customer with send_weekly_link=true,
// priority desc.
export async function getWeeklyUpdateQueue(): Promise<SendQueueRow[]> {
  const weekOf = weekOfMondayNY();

  const [customers, sendMap] = await Promise.all([
    query<{
      id: string;
      name: string;
      phone: string | null;
      token: string;
      priority: number;
    }>(
      `select id, name, phone, token, priority from customers
        where is_active and send_weekly_link
        order by priority desc, name asc`,
    ),
    loadSendStateMap(weekOf, "weekly_update"),
  ]);

  return customers.map((c) => ({
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

// ordering_schedule is a singleton (DEC-030). Same queryOne discipline as
// getOrderingOpen — loud failure if the row goes missing.
export async function getIntroNote(): Promise<string> {
  const row = await queryOne<{ intro_note: string | null }>(
    "getIntroNote",
    `select intro_note from ordering_schedule`,
  );
  return row.intro_note ?? "";
}

// Count of weekly_update unsent for the current week — used by the admin
// nav badge on Send Texts. Order-confirmation and pickup-reminder sends moved
// onto the Orders page (#190), so weekly_update is the only mode this page
// handles. Runs on every admin page render via the layout, so we avoid the
// full queue load: count subscribers, subtract sent rows for the week.
export async function getWeeklyUpdateUnsentCount(): Promise<number> {
  const weekOf = weekOfMondayNY();

  const [subscribers, sent] = await Promise.all([
    query<{ count: number }>(
      `select count(*)::int as count from customers
        where is_active and send_weekly_link`,
    ),
    query<{ count: number }>(
      `select count(*)::int as count from customer_sends
        where week_of = $1 and mode = 'weekly_update'`,
      [weekOf],
    ),
  ]);

  return Math.max(0, subscribers[0].count - sent[0].count);
}
