"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { pgMessage } from "@/lib/pg-errors";

export type SetBaseUnitResult = {
  error: string | null;
};

// #208 (DEC-038) — promote a product_units row to base. Thin wrapper over the
// set_base_unit function, which atomically rescales every unit's conversion +
// the product's qty_available and renumbers sort_order so the new base sorts
// first (becoming the customer default). Deliberately NOT folded into
// saveProductUnits' staged save — re-basing touches live stock and must run
// as one server-side transaction, not as a diff of row updates.
export async function setBaseUnit(
  productId: string,
  unitId: string,
): Promise<SetBaseUnitResult> {
  const user = await getAdminUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await query(`select set_base_unit($1, $2)`, [productId, unitId]);
  } catch (e) {
    const message = pgMessage(e);
    // Map the function's raise texts to remedies Annabel can act on; anything
    // else surfaces raw (same contract as saveProductUnits).
    if (message.includes("is inactive")) {
      return {
        error:
          "An inactive unit can't be the base. Turn its Active switch on and save first.",
      };
    }
    if (message.includes("does not belong")) {
      return {
        error: "That unit doesn't belong to this product. Reload and try again.",
      };
    }
    if (message.includes("too far apart in scale")) {
      return {
        error:
          "These units are too far apart in size to switch the base unit. Adjust the conversions closer first.",
      };
    }
    return { error: message };
  }

  revalidatePath("/admin/inventory");
  return { error: null };
}
