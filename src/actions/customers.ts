"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CustomerInput = {
  name: string;
  business_name: string;
  email: string;
  phone: string;
  delivery_address: string;
  priority: number;
  send_weekly_link: boolean;
  is_active: boolean;
};

function validate(input: CustomerInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  const hasEmail = input.email.trim().length > 0;
  const hasPhone = input.phone.trim().length > 0;
  if (!hasEmail && !hasPhone) return "At least one of email or phone is required.";
  if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return "Email looks malformed.";
  }
  if (!Number.isInteger(input.priority) || input.priority < 0) {
    return "Priority must be a whole number, zero or greater.";
  }
  return null;
}

function normalize(input: CustomerInput) {
  return {
    name: input.name.trim(),
    business_name: input.business_name.trim() || null,
    email: input.email.trim() || null,
    phone: input.phone.trim() || null,
    delivery_address: input.delivery_address.trim() || null,
    priority: input.priority,
    send_weekly_link: input.send_weekly_link,
    is_active: input.is_active,
  };
}

export async function createCustomer(input: CustomerInput): Promise<{ error: string | null; id: string | null }> {
  const validationError = validate(input);
  if (validationError) return { error: validationError, id: null };

  const supabase = await createClient();
  const placeholderToken = `placeholder-${crypto.randomUUID()}`;
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...normalize(input), token: placeholderToken })
    .select("id")
    .single();

  if (error) return { error: error.message, id: null };
  revalidatePath("/admin/customers");
  return { error: null, id: data.id };
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<string | null> {
  const validationError = validate(input);
  if (validationError) return validationError;

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ ...normalize(input), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return error.message;
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
  return null;
}

export async function toggleCustomerActive(id: string, is_active: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/customers");
  return { error: null };
}
