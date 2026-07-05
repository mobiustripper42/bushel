"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { pgCode, pgMessage, FOREIGN_KEY_VIOLATION } from "@/lib/pg-errors";

export type UnitInput = {
  // null = new unit (insert); non-null = existing (update)
  id: string | null;
  label: string;
  conversion_to_base: number;
  unit_price_cents: number;
  is_active: boolean;
  sort_order: number | null;
  // DEC-043: Wave Item Number for this unit's export lines; null → the
  // generated slug covers the export.
  sku: string | null;
};

export type SaveProductUnitsInput = {
  productId: string;
  units: UnitInput[];
  deletedUnitIds: string[];
};

export type SaveProductUnitsResult = {
  error: string | null;
};

// Slug format matches the 6.5a safety-net trigger:
//   <product-name-slug>-<unit-label-slug>-<first 8 chars of product_id>
// The id8 suffix keeps slugs globally unique even when two products share a
// name. The base unit's slug (created by the trigger) omits the unit-label
// segment — additional units sit alongside under <name>-<label>-<id8>.
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unitSlug(productName: string, productId: string, label: string): string {
  const nameSlug = slugify(productName);
  const labelSlug = slugify(label);
  const id8 = productId.slice(0, 8);
  return `${nameSlug}-${labelSlug}-${id8}`;
}

export async function saveProductUnits(
  input: SaveProductUnitsInput,
): Promise<SaveProductUnitsResult> {
  if (input.units.length === 0) {
    return { error: "A product must have at least one unit." };
  }

  const trimmed = input.units.map((u) => ({
    ...u,
    label: u.label.trim(),
    sku: u.sku?.trim() || null,
  }));

  for (const u of trimmed) {
    if (!u.label) return { error: "Every unit needs a label." };
    if (!(u.conversion_to_base > 0)) {
      return { error: `Conversion must be greater than zero (check "${u.label}").` };
    }
    // Matches the unit_price_cents > 0 DB CHECK — a $0 unit used to slip past
    // validation and surface as a raw constraint violation.
    if (!Number.isInteger(u.unit_price_cents) || u.unit_price_cents <= 0) {
      return { error: `Price must be greater than zero (check "${u.label}").` };
    }
  }

  const seen = new Map<string, string>();
  for (const u of trimmed) {
    const key = u.label.toLowerCase();
    if (seen.has(key)) {
      return {
        error: `Two units share the label "${u.label}". Labels must be unique within a product.`,
      };
    }
    seen.set(key, u.label);
  }

  if (!trimmed.some((u) => u.is_active)) {
    return { error: "At least one unit must stay active." };
  }

  // DEC-037: product_units is now authoritative and saveInventory's inline
  // unit/price edits target the single conversion_to_base = 1.0 base row.
  // Protect that invariant here — exactly one base unit must survive every
  // save, or the inline editor's writes would silently miss (or hit two rows).
  // Changing WHICH unit is the base is #208; this only guards against losing
  // or doubling it.
  const baseCount = trimmed.filter((u) => u.conversion_to_base === 1).length;
  if (baseCount !== 1) {
    return {
      error:
        baseCount === 0
          ? "One unit must be the base unit (conversion of 1)."
          : "Only one unit can be the base unit (conversion of 1).",
    };
  }

  // RLS is gone (DEC-048) — explicit gate replaces the cookie-client policy pair.
  const user = await getAdminUser();
  if (!user) return { error: "Unauthorized" };

  const productRows = await query<{ id: string; name: string }>(
    `select id, name from products where id = $1`,
    [input.productId],
  );
  const product = productRows[0];
  if (!product) {
    return { error: "Product not found." };
  }

  // Delete first so existing labels can be reassigned within the same save
  // without colliding on the unique (product_id, label) index.
  if (input.deletedUnitIds.length > 0) {
    try {
      await query(`delete from product_units where id = any($1)`, [
        input.deletedUnitIds,
      ]);
    } catch (e) {
      // order_items.product_unit_id is ON DELETE RESTRICT. Surface a friendly
      // message so Annabel knows the remedy (deactivate instead of delete)
      // without seeing the raw FK constraint name.
      if (pgCode(e) === FOREIGN_KEY_VIOLATION) {
        return {
          error:
            "Can't delete a unit that's already on an existing order. Turn the Active switch off instead — customers won't see it next week.",
        };
      }
      return { error: pgMessage(e) };
    }
  }

  for (const u of trimmed) {
    try {
      if (u.id === null) {
        const slug = unitSlug(product.name, product.id, u.label);
        await query(
          `insert into product_units
             (product_id, label, conversion_to_base, unit_price_cents,
              is_active, sort_order, sku, slug)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            input.productId,
            u.label,
            u.conversion_to_base,
            u.unit_price_cents,
            u.is_active,
            u.sort_order,
            u.sku,
            slug,
          ],
        );
      } else {
        await query(
          `update product_units
              set label = $1, conversion_to_base = $2, unit_price_cents = $3,
                  is_active = $4, sort_order = $5, sku = $6, updated_at = now()
            where id = $7`,
          [
            u.label,
            u.conversion_to_base,
            u.unit_price_cents,
            u.is_active,
            u.sort_order,
            u.sku,
            u.id,
          ],
        );
      }
    } catch (e) {
      return { error: pgMessage(e) };
    }
  }

  revalidatePath("/admin/inventory");
  return { error: null };
}
