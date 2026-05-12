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
  if (!Number.isFinite(row.price_cents) || row.price_cents < 0) {
    return `Row ${index + 1}: price must be zero or greater.`;
  }
  if (!Number.isInteger(row.qty_available) || row.qty_available < 0) {
    return `Row ${index + 1}: qty must be a non-negative whole number.`;
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

  if (input.deletedIds.length > 0) {
    const { error } = await supabase.from("products").delete().in("id", input.deletedIds);
    if (error) return { error: error.message };
  }

  const newIdMap: Record<string, string> = {};

  for (const row of input.rows) {
    const payload = {
      name: row.name.trim(),
      category: row.category,
      description: row.description?.trim() || null,
      unit: row.unit.trim(),
      price_cents: row.price_cents,
      qty_available: row.qty_available,
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
      if (error) return { error: error.message };
      if (data) newIdMap[row.id] = data.id;
    } else {
      const { error } = await supabase.from("products").update(payload).eq("id", row.id);
      if (error) return { error: error.message };
    }
  }

  revalidatePath("/admin/inventory");
  return { error: null, newIdMap };
}
