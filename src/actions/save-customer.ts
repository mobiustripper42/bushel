"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { pgCode, pgMessage, UNIQUE_VIOLATION } from "@/lib/pg-errors";
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

  // RLS is gone (DEC-048) — the explicit gate replaces the old cookie-client
  // + admin_all policy pair.
  const user = await getAdminUser();
  if (!user) return { error: "Unauthorized" };

  const trimmed = {
    name: input.name.trim(),
    business_name: input.business_name?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    delivery_address: input.delivery_address?.trim() || null,
    priority: input.priority,
    send_weekly_link: input.send_weekly_link,
  };

  if (input.id) {
    try {
      await query(
        `update customers
            set name = $1, business_name = $2, email = $3, phone = $4,
                delivery_address = $5, priority = $6, send_weekly_link = $7,
                updated_at = now()
          where id = $8`,
        [
          trimmed.name,
          trimmed.business_name,
          trimmed.email,
          trimmed.phone,
          trimmed.delivery_address,
          trimmed.priority,
          trimmed.send_weekly_link,
          input.id,
        ],
      );
    } catch (e) {
      return { error: pgMessage(e) };
    }
    revalidatePath("/admin/customers");
    revalidatePath("/admin/inventory");
    return { error: null, customerId: input.id };
  }

  for (let attempt = 0; attempt < TOKEN_INSERT_RETRIES; attempt++) {
    try {
      const rows = await query<{ id: string }>(
        `insert into customers
           (name, business_name, email, phone, delivery_address, priority,
            send_weekly_link, token, is_active)
         values ($1, $2, $3, $4, $5, $6, $7, $8, true)
         returning id`,
        [
          trimmed.name,
          trimmed.business_name,
          trimmed.email,
          trimmed.phone,
          trimmed.delivery_address,
          trimmed.priority,
          trimmed.send_weekly_link,
          generateToken(),
        ],
      );
      revalidatePath("/admin/customers");
      revalidatePath("/admin/inventory");
      return { error: null, customerId: rows[0].id };
    } catch (e) {
      // Token collision → retry with a fresh token; anything else surfaces.
      if (pgCode(e) !== UNIQUE_VIOLATION) return { error: pgMessage(e) };
    }
  }
  return { error: "Could not generate a unique token. Try again." };
}
