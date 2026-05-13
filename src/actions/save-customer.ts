"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CustomerInput = {
  id: string | null;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  delivery_address: string | null;
  priority: number;
  send_weekly_link: boolean;
};

export type SaveCustomerResult = {
  error: string | null;
  customerId?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(input: CustomerInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  const phone = input.phone?.trim() ?? "";
  if (!phone) return "Phone is required.";
  const email = input.email?.trim() ?? "";
  if (email && !EMAIL_RE.test(email)) return "Email format looks off.";
  if (!Number.isInteger(input.priority) || input.priority < 0) {
    return "Priority must be a whole number, zero or greater.";
  }
  return null;
}

// 3.2 owns proper short-token generation + collision retry. Use the full
// UUID here so placeholder rows aren't trivially guessable while 3.1 is
// reachable in production.
function placeholderToken(): string {
  return "tmp-" + crypto.randomUUID();
}

export async function saveCustomer(input: CustomerInput): Promise<SaveCustomerResult> {
  const err = validate(input);
  if (err) return { error: err };

  const supabase = await createClient();
  const now = new Date().toISOString();

  const trimmed = {
    name: input.name.trim(),
    business_name: input.business_name?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    delivery_address: input.delivery_address?.trim() || null,
    priority: input.priority,
    send_weekly_link: input.send_weekly_link,
    updated_at: now,
  };

  if (input.id) {
    const { error } = await supabase
      .from("customers")
      .update(trimmed)
      .eq("id", input.id);
    if (error) return { error: error.message };
    revalidatePath("/admin/customers");
    return { error: null, customerId: input.id };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({ ...trimmed, token: placeholderToken(), is_active: true })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/admin/customers");
  return { error: null, customerId: data.id };
}
