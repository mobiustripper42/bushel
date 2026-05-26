"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_CATEGORIES = ["Vegetables", "Fruit", "Herbs", "Flowers", "Other"] as const;
type Category = (typeof ALLOWED_CATEGORIES)[number];

export type InventoryRowInput = {
  id: string;
  isNew?: boolean;
  name: string;
  category: string;
  description: string | null;
  unit: string;
  price_cents: number;
  qty_available: number;
  is_available: boolean;
  sort_order: number | null;
};

export type SaveInventoryInput = {
  rows: InventoryRowInput[];
  deletedIds: string[];
};

export type SaveInventoryResult = {
  error: string | null;
  newIdMap?: Record<string, string>;
};

function validateRow(row: InventoryRowInput, index: number): string | null {
  if (!row.name.trim()) return `Row ${index + 1}: name is required.`;
  if (!row.unit.trim()) return `Row ${index + 1}: unit is required.`;
  if (!ALLOWED_CATEGORIES.includes(row.category as Category)) {
    return `Row ${index + 1}: invalid category.`;
  }
  if (!Number.isFinite(row.price_cents) || row.price_cents <= 0) {
    return `Row ${index + 1}: price must be greater than zero.`;
  }
  // qty allows negatives — DEC-012 optimistic oversell. Admin must be able
  // to record an oversold state by direct entry, not only via order placement.
  // Fractions are allowed: multi-unit decrement (qty * conversion_to_base)
  // produces non-integer remainders, and products.qty_available is numeric(10,2).
  if (!Number.isFinite(row.qty_available)) {
    return `Row ${index + 1}: qty must be a number.`;
  }
  return null;
}

export async function saveInventory(input: SaveInventoryInput): Promise<SaveInventoryResult> {
  for (let i = 0; i < input.rows.length; i++) {
    const err = validateRow(input.rows[i], i);
    if (err) return { error: err };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const newIdMap: Record<string, string> = {};

  if (input.deletedIds.length > 0) {
    const { error } = await supabase.from("products").delete().in("id", input.deletedIds);
    if (error) return { error: error.message, newIdMap };
  }

  for (const row of input.rows) {
    const payload = {
      name: row.name.trim(),
      category: row.category,
      description: row.description?.trim() || null,
      unit: row.unit.trim(),
      price_cents: row.price_cents,
      qty_available: Math.round(row.qty_available * 100) / 100,
      is_available: row.is_available,
      sort_order: row.sort_order,
      updated_at: now,
    };

    if (row.isNew) {
      const { data, error } = await supabase
        .from("products")
        .insert(payload)
        .select("id")
        .single();
      if (error) return { error: error.message, newIdMap };
      if (data) newIdMap[row.id] = data.id;
    } else {
      const { error } = await supabase.from("products").update(payload).eq("id", row.id);
      if (error) return { error: error.message, newIdMap };
    }
  }

  revalidatePath("/admin/inventory");
  return { error: null, newIdMap };
}
