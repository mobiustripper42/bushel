"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateToken } from "@/lib/tokens";

const TOKEN_INSERT_RETRIES = 5;

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
    revalidatePath("/admin/inventory");
    return { error: null, customerId: input.id };
  }

  for (let attempt = 0; attempt < TOKEN_INSERT_RETRIES; attempt++) {
    const { data, error } = await supabase
      .from("customers")
      .insert({ ...trimmed, token: generateToken(), is_active: true })
      .select("id")
      .single();
    if (!error) {
      revalidatePath("/admin/customers");
      revalidatePath("/admin/inventory");
      return { error: null, customerId: data.id };
    }
    // 23505 = unique_violation in Postgres
    if (error.code !== "23505") return { error: error.message };
  }
  return { error: "Could not generate a unique token. Try again." };
}
