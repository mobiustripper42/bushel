"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { pgCode, pgMessage, UNIQUE_VIOLATION } from "@/lib/pg-errors";

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

export async function saveInventory(input: SaveInventoryInput): Promise<SaveInventoryResult> {
  for (let i = 0; i < input.rows.length; i++) {
    const err = validateRow(input.rows[i], i);
    if (err) return { error: err };
  }

  // RLS is gone (DEC-048) — explicit gate replaces the cookie-client policy pair.
  const user = await getAdminUser();
  if (!user) return { error: "Unauthorized" };

  const newIdMap: Record<string, string> = {};

  // #207 — products are never hard-deleted; the editor's trash button stages a
  // soft-hide (is_active=false), persisted through the row update below. This
  // keeps order_items references intact.
  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    const rowLabel = `Row ${i + 1}`;
    const unitLabel = row.unit.trim();
    const payload = [
      row.name.trim(),
      row.category,
      row.description?.trim() || null,
      Math.round(row.qty_available * 100) / 100,
      row.is_available,
      row.is_active,
      row.sort_order,
    ];

    if (row.isNew) {
      let productId: string;
      try {
        const rows = await query<{ id: string }>(
          `insert into products
             (name, category, description, qty_available, is_available,
              is_active, sort_order)
           values ($1, $2, $3, $4, $5, $6, $7)
           returning id`,
          payload,
        );
        productId = rows[0].id;
      } catch (e) {
        return { error: pgMessage(e), newIdMap };
      }

      // DEC-037: the spawn trigger is gone — saveInventory owns the base
      // product_units row. Insert it right after the product; on failure,
      // compensating-delete the product so the "every product has a base
      // unit" invariant holds (same row-by-row non-atomic style as the rest
      // of this action).
      try {
        await query(
          `insert into product_units
             (product_id, label, conversion_to_base, unit_price_cents,
              is_active, sort_order, slug)
           values ($1, $2, 1.0, $3, true, 0, $4)`,
          [productId, unitLabel, row.price_cents, baseUnitSlug(row.name.trim(), productId)],
        );
      } catch (e) {
        // Best-effort compensating delete — if it fails we leak a base-unit-less
        // product, but the original error is the one worth surfacing.
        await query(`delete from products where id = $1`, [productId]).catch(
          () => {},
        );
        return { error: `${rowLabel}: ${pgMessage(e)}`, newIdMap };
      }
      newIdMap[row.id] = productId;
    } else {
      try {
        await query(
          `update products
              set name = $1, category = $2, description = $3,
                  qty_available = $4, is_available = $5, is_active = $6,
                  sort_order = $7, updated_at = now()
            where id = $8`,
          [...payload, row.id],
        );
      } catch (e) {
        return { error: pgMessage(e), newIdMap };
      }

      // Existing product: the inline unit/price fields edit the base unit row.
      // Capture the affected id — a zero-row update means the product has no
      // conversion_to_base = 1.0 row (a violated invariant, normally prevented
      // by saveProductUnits). Fail loud rather than silently dropping the edit.
      let updated: Array<{ id: string }>;
      try {
        updated = await query<{ id: string }>(
          `update product_units
              set label = $1, unit_price_cents = $2, updated_at = now()
            where product_id = $3 and conversion_to_base = 1.0
            returning id`,
          [unitLabel, row.price_cents, row.id],
        );
      } catch (e) {
        // unique (product_id, label) — the dropped mirror trigger used to
        // silently skip on this collision; DEC-037 surfaces it as a row error.
        if (pgCode(e) === UNIQUE_VIOLATION) {
          return {
            error: `${rowLabel}: the unit label "${unitLabel}" is already used by another unit on this product.`,
            newIdMap,
          };
        }
        return { error: `${rowLabel}: ${pgMessage(e)}`, newIdMap };
      }
      if (updated.length === 0) {
        return {
          error: `${rowLabel}: no base unit found for "${row.name.trim()}". Open its units and set one unit's conversion to 1.`,
          newIdMap,
        };
      }
    }
  }

  revalidatePath("/admin/inventory");
  return { error: null, newIdMap };
}
