---
id: DEC-038
title: "Base-unit change is an atomic, invariant-preserving rebase (#208)"
topic: "Catalog, pricing & units"
---

## DEC-038: Base-unit change is an atomic, invariant-preserving rebase (#208)

**Decision:** changing which `product_units` row is a product's base unit is a single server-side operation (`set_base_unit` RPC, migration `20260612153000`) that divides EVERY unit's `conversion_to_base` AND `products.qty_available` by the new base's old conversion, then renumbers `sort_order` so the new base sorts first. Making a unit the base also makes it the customer's default-selected unit — one deliberate action, both effects. Unit prices are untouched.

**Why:**
- `qty_available` is stored in base units and `order_items` read conversion live from `product_units` (no per-line conversion snapshot), so a line's footprint is `qty * live_conv`. Rescaling all conversions and the stock figure by the same factor leaves every historical comparison physically unchanged — oversold state and `needs_reconciliation` can't flip. Doing it as anything other than one transaction (e.g. folding it into the drawer's staged Save) would open a window where conversions and stock disagree.
- Prices are per-unit truths ("$6 per lb" holds regardless of what stock is counted in), so they don't participate in the rescale.
- The customer form defaults to `units[0]` (sorted by `sort_order nulls last, created_at`); renumbering with the new base at 0 is how "make base" doubles as "make default" without a new column.

**Guard rails:** the drawer's "Make base" affordance only appears on saved, active, non-base rows; it's disabled while the drawer has unsaved edits (the post-rebase reload would clobber them); and it confirms via modal before calling the RPC. The RPC raises on cross-product, missing, or inactive units and no-ops when the unit is already base.

---
