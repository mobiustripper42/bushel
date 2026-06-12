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
  // DEC-037: unit/price live on the base product_units row, not products.
  // The inline editor still edits them per-row; only the write target moved.
  unit: string;
  price_cents: number;
  qty_available: number;
  is_available: boolean;
  is_active: boolean;
  sort_order: number | null;
};

export type SaveInventoryInput = {
  rows: InventoryRowInput[];
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
  // > 0 also satisfies the product_units.unit_price_cents > 0 CHECK.
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

// Base-unit slug, matching the 20260522175735 backfill format:
// lowercased name with non-alphanumerics collapsed to '-' and trimmed, plus
// the first 8 chars of the product id (uniqueness when names collide).
function baseUnitSlug(name: string, productId: string): string {
  const nameSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${nameSlug}-${productId.slice(0, 8)}`;
}

// unique (product_id, label) — the dropped mirror trigger used to silently
// skip on this collision; DEC-037 surfaces it as a row error instead.
function isUniqueViolation(code: string | undefined): boolean {
  return code === "23505";
}

export async function saveInventory(input: SaveInventoryInput): Promise<SaveInventoryResult> {
  for (let i = 0; i < input.rows.length; i++) {
    const err = validateRow(input.rows[i], i);
    if (err) return { error: err };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const newIdMap: Record<string, string> = {};

  // #207 — products are never hard-deleted; the editor's trash button stages a
  // soft-hide (is_active=false), persisted through the row update below. This
  // keeps order_items references intact.
  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    const rowLabel = `Row ${i + 1}`;
    const unitLabel = row.unit.trim();
    const payload = {
      name: row.name.trim(),
      category: row.category,
      description: row.description?.trim() || null,
      qty_available: Math.round(row.qty_available * 100) / 100,
      is_available: row.is_available,
      is_active: row.is_active,
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
      if (!data) return { error: `${rowLabel}: insert returned no id.`, newIdMap };

      // DEC-037: the spawn trigger is gone — saveInventory owns the base
      // product_units row. Insert it right after the product; on failure,
      // compensating-delete the product so the "every product has a base
      // unit" invariant holds (same row-by-row non-atomic style as the rest
      // of this action).
      const { error: unitError } = await supabase.from("product_units").insert({
        product_id: data.id,
        label: unitLabel,
        conversion_to_base: 1.0,
        unit_price_cents: row.price_cents,
        is_active: true,
        sort_order: 0,
        slug: baseUnitSlug(row.name.trim(), data.id),
      });
      if (unitError) {
        await supabase.from("products").delete().eq("id", data.id);
        return { error: `${rowLabel}: ${unitError.message}`, newIdMap };
      }
      newIdMap[row.id] = data.id;
    } else {
      const { error } = await supabase.from("products").update(payload).eq("id", row.id);
      if (error) return { error: error.message, newIdMap };

      // Existing product: the inline unit/price fields edit the base unit row.
      const { error: unitError } = await supabase
        .from("product_units")
        .update({ label: unitLabel, unit_price_cents: row.price_cents })
        .eq("product_id", row.id)
        .eq("conversion_to_base", 1.0);
      if (unitError) {
        if (isUniqueViolation(unitError.code)) {
          return {
            error: `${rowLabel}: the unit label "${unitLabel}" is already used by another unit on this product.`,
            newIdMap,
          };
        }
        return { error: `${rowLabel}: ${unitError.message}`, newIdMap };
      }
    }
  }

  revalidatePath("/admin/inventory");
  return { error: null, newIdMap };
}
