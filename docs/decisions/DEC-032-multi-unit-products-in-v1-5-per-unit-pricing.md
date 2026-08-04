---
id: DEC-032
title: "Multi-unit products in V1.5 (per-unit pricing; inventory in base units)"
topic: "Catalog, pricing & units"
---

## DEC-032: Multi-unit products in V1.5 (per-unit pricing; inventory in base units)

**Decision:** Multi-unit products are not in V1. V1 ships with one unit per product. **V1.5** is a focused follow-up phase (Phase 6.5 in PROJECT_PLAN.md) that adds multi-unit support. Reverses neither DEC-007 (per-customer pricing stays deferred to V2) nor any other prior decision.

**Model when V1.5 ships:**

- Each product has a `base_unit` (e.g. "lb") and `qty_available numeric(10,2)` tracked in base units.
- New table `product_units (id, product_id, unit text, conversion_to_base numeric(10,4), price_cents integer, sort_order integer, is_active boolean)`. Each product has at least one row (the base unit, conversion=1.0). Cherry tomatoes might have three: lb (1.0), pint (0.83), flat (10.0).
- `order_items` gains `product_unit_id` FK. `unit_price_cents` continues to snapshot, now from the chosen unit's price.
- Decrement at order time: `products.qty_available -= order_items.qty * product_units.conversion_to_base`. No rounding — fractional decrements are honest and `numeric(10,2)` handles them cleanly.
- Per-unit pricing is **independent**, not auto-computed from the conversion factor. Annabel sets pint=$5.00, lb=$4.50, flat=$40.00 directly. Conversion factors govern inventory math only.
- Per-unit sold-out check: a unit's radio is greyed out when `qty_available < conversion_to_base`. Whole-product sold-out when no active unit is orderable.
- Customer-side UI: radio-button picker when a product has 2+ active units, no picker when only 1. Switching the radio resets qty to 0 (carrying "6 pints" across to "6 flats" is a recipe for accidental $240 orders).

**Explicit non-coupling to DEC-007:** Per-unit pricing is *not* per-customer pricing. All customers see the same pint price, the same lb price, the same flat price.

**Why V1.5 and not V1:**
- V1 ships sooner. Real customer usage informs whether multi-unit needs to land in week 2 or month 2 after launch.
- Multi-unit roughly doubles Phase 2 scope and adds meaningful surface to Phase 3 (admin inventory editor, customer form, sold-out logic, pre-fill behavior). Slotting it as its own phase keeps the V1 plan coherent.

**Why not V2:**
- Selling the same physical product in different denominations is core wholesale produce behavior, not a "nice to have." Deferring to V2 means an indeterminate slip; V1.5 is a committed follow-up with a sized scope.

**Known V1 kludge:** for products that genuinely need multiple units in V1 (Annabel will identify these), create them as separate products: "Cherry tomatoes (lb)" and "Cherry tomatoes (pint)" with separately-managed `qty_available`. Annabel reconciles harvest-to-inventory split mentally. Tolerable for ~3 products for ~weeks. If the count is higher, this DEC's V1/V1.5 split should be revisited and multi-unit pulled forward into V1.

**Trigger to validate now:** Annabel-facing question — *"How many of the products you sell need to be sold in different units to different customers?"* If answer is 2–3, V1.5 framing holds. If "most of them," pull forward into V1.

---
