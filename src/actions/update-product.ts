"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type UpdateProductInput = {
  id: string;
  name: string;
  unit: string;
  price_cents: number;
  qty_available: number;
  is_available: boolean;
};

export async function updateProduct(input: UpdateProductInput): Promise<string | null> {
  const { id, name, unit, price_cents, qty_available, is_available } = input;

  if (!name.trim()) return "Name is required.";
  if (!unit.trim()) return "Unit is required.";
  if (!Number.isFinite(price_cents) || price_cents < 0) return "Price must be zero or greater.";
  if (!Number.isInteger(qty_available) || qty_available < 0) return "Qty must be a non-negative whole number.";

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ name: name.trim(), unit: unit.trim(), price_cents, qty_available, is_available, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return error.message;
  revalidatePath("/admin/inventory");
  return null;
}
