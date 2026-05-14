"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CUSTOMER_TOKEN_COOKIE,
  lookupCustomerByToken,
} from "@/lib/customer/session";
import type { Json } from "@/lib/supabase/types";
import { weekOfMondayNY } from "@/lib/week";

export type PlaceOrderItem = {
  product_id: string;
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

  if (error) return { error: error.message };

  redirect(`/c/${token}/confirmed`);
}
