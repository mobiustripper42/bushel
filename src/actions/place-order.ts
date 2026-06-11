"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CUSTOMER_TOKEN_COOKIE,
  lookupCustomerByToken,
} from "@/lib/customer/session";
import { sendAdminOrderAlert } from "@/lib/notifications/admin-telegram";
import { totalItemCount } from "@/lib/order-items";
import type { Json } from "@/lib/supabase/types";
import { weekOfMondayNY } from "@/lib/week";

export type PlaceOrderItem = {
  product_id: string;
  // 6.5d: identifies which unit of the product is being ordered. The
  // place_order RPC looks up unit_price_cents + conversion_to_base from
  // product_units at order time — the unit_price_cents field on the
  // payload is now informational only (the RPC ignores it).
  product_unit_id: string;
  qty: number;
  unit_price_cents: number;
};

export type PlaceOrderPayload = {
  mode: "delivery" | "pickup";
  items: PlaceOrderItem[];
  delivery_preference: string;
  pickup_note: string;
  notes: string;
};

export async function placeOrder(
  payload: PlaceOrderPayload,
): Promise<{ error: string | null }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_TOKEN_COOKIE)?.value;
  const customer = await lookupCustomerByToken(token);
  if (!customer || !token) {
    return { error: "Session expired. Reload the page." };
  }

  // #130 — page-level shell short-circuits the form for these states.
  // Only path that reaches here is a stale tab + a direct submit. Send
  // them back to /c/[token] where the friendly shell copy lives; don't
  // duplicate it in an inline error.
  if (!customer.is_active || !customer.send_weekly_link) {
    return { error: "This link isn't active anymore. Reload the page." };
  }

  if (payload.items.length === 0) {
    return { error: "Add at least one item before submitting." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("place_order", {
    p_customer_id: customer.id,
    p_week_of: weekOfMondayNY(),
    p_fulfillment_type: payload.mode,
    p_delivery_address:
      payload.mode === "delivery" ? (customer.delivery_address ?? "") : "",
    p_delivery_preference:
      payload.mode === "delivery" ? payload.delivery_preference.trim() : "",
    p_pickup_note: payload.mode === "pickup" ? payload.pickup_note.trim() : "",
    p_notes: payload.notes.trim(),
    p_items: payload.items as unknown as Json,
  });

  if (error) {
    // #132 / DEC-036: place_order rejects items whose product is sold out
    // (qty_available = 0) at submit time — the stale-tab race. Surface a
    // friendly, actionable message instead of the raw RPC text; reloading
    // re-fetches inventory and greys the sold-out rows.
    if (error.message.includes("is sold out")) {
      return {
        error:
          "Some items sold out while you were ordering. Reload to see what's still available.",
      };
    }
    return { error: error.message };
  }

  // Best-effort admin alert (DEC-033). Failure is swallowed inside the
  // wrapper — order placement never blocks on a notification miss. We
  // await so the serverless function doesn't terminate before the POST
  // completes; ~200ms of customer-perceptible latency on submit.
  //
  // TODO(DEC-033): once place_order RPC ever applies pricing rules
  // (discounts, rounding), read the total from the inserted order row
  // instead of recomputing from the payload here.
  const total = payload.items.reduce(
    (sum, it) => sum + it.qty * it.unit_price_cents,
    0,
  );
  await sendAdminOrderAlert({
    customerName: customer.name,
    weekOf: weekOfMondayNY(),
    itemCount: totalItemCount(payload.items),
    totalCents: total,
    adminOrdersUrl: `${adminBaseUrl()}/admin/orders`,
  });

  redirect(`/c/${token}/confirmed`);
}

// Admin link in the Telegram alert must always point at prod (where Annabel
// works), not at whatever host the customer placed the order from. Preview
// deployments shouldn't deep-link Annabel into preview data.
function adminBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://order.baybranchfarm.com";
}
