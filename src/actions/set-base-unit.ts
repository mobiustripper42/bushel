"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SetBaseUnitResult = {
  error: string | null;
};

// #208 (DEC-038) — promote a product_units row to base. Thin wrapper over the
// set_base_unit RPC, which atomically rescales every unit's conversion + the
// product's qty_available and renumbers sort_order so the new base sorts
// first (becoming the customer default). Deliberately NOT folded into
// saveProductUnits' staged save — re-basing touches live stock and must run
// as one server-side transaction, not as a diff of row updates.
export async function setBaseUnit(
  productId: string,
  unitId: string,
): Promise<SetBaseUnitResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_base_unit", {
    p_product_id: productId,
    p_new_base_unit_id: unitId,
  });

  if (error) {
    // Map the RPC's raise texts to remedies Annabel can act on; anything
    // else surfaces raw (same contract as saveProductUnits).
    if (error.message.includes("is inactive")) {
      return {
        error:
          "An inactive unit can't be the base. Turn its Active switch on and save first.",
      };
    }
    if (error.message.includes("does not belong")) {
      return {
        error: "That unit doesn't belong to this product. Reload and try again.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/inventory");
  return { error: null };
}
