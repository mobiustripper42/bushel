---
id: DEC-043
title: "Per-unit editable SKU; `description` leaves the Wave export"
topic: "Catalog, pricing & units"
---

## DEC-043: Per-unit editable SKU; `description` leaves the Wave export

**Decision:** Add editable `sku text` (nullable) to **`product_units`**, exposed in the units drawer labeled **"SKU."** Repoint the Wave export: Item Number ← the line's `product_units.sku`, falling back to `product_units.slug`, then blank. Remove `products.description` from the export entirely — it reverts to its sole purpose, the customer-facing long description.

**Why:** `description` is conflicted — the inventory editor presents it as the customer-facing long description while `export-orders.ts` emits it as Wave's Item Number, so a customer note silently becomes an invoice item number. Under multi-unit, SKU is a **per-unit** truth (one product → multiple Wave line items). Editable (not the auto `slug`) lets Annabel match Bushel's SKUs to her existing Wave item catalog.

**Migration:** add `product_units.sku`; backfill NULL (Annabel fills as needed); `slug` stays as fallback.

---
