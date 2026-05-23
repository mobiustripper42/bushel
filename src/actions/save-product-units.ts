"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UnitInput = {
  // null = new unit (insert); non-null = existing (update)
  id: string | null;
  label: string;
  conversion_to_base: number;
  unit_price_cents: number;
  is_active: boolean;
  sort_order: number | null;
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

  const trimmed = input.units.map((u) => ({ ...u, label: u.label.trim() }));

  for (const u of trimmed) {
    if (!u.label) return { error: "Every unit needs a label." };
    if (!(u.conversion_to_base > 0)) {
      return { error: `Conversion must be greater than zero (check "${u.label}").` };
    }
    if (!Number.isInteger(u.unit_price_cents) || u.unit_price_cents < 0) {
      return { error: `Price must be a non-negative amount (check "${u.label}").` };
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

  const supabase = await createClient();

  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", input.productId)
    .single();
  if (prodErr || !product) {
    return { error: prodErr?.message ?? "Product not found." };
  }

  // Delete first so existing labels can be reassigned within the same save
  // without colliding on the unique (product_id, label) index.
  if (input.deletedUnitIds.length > 0) {
    const { error } = await supabase
      .from("product_units")
      .delete()
      .in("id", input.deletedUnitIds);
    if (error) return { error: error.message };
  }

  for (const u of trimmed) {
    if (u.id === null) {
      const slug = unitSlug(product.name, product.id, u.label);
      const { error } = await supabase.from("product_units").insert({
        product_id: input.productId,
        label: u.label,
        conversion_to_base: u.conversion_to_base,
        unit_price_cents: u.unit_price_cents,
        is_active: u.is_active,
        sort_order: u.sort_order,
        slug,
      });
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase
        .from("product_units")
        .update({
          label: u.label,
          conversion_to_base: u.conversion_to_base,
          unit_price_cents: u.unit_price_cents,
          is_active: u.is_active,
          sort_order: u.sort_order,
        })
        .eq("id", u.id);
      if (error) return { error: error.message };
    }
  }

  revalidatePath("/admin/inventory");
  return { error: null };
}
