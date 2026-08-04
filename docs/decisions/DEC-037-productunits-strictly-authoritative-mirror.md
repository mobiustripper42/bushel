---
id: DEC-037
title: "`product_units` strictly authoritative; mirror columns dropped (#212, closes the DEC-032 transition)"
topic: "Catalog, pricing & units"
---

## DEC-037: `product_units` strictly authoritative; mirror columns dropped (#212, closes the DEC-032 transition)

`products.unit` and `products.price_cents` are dropped, along with the bidirectional mirror triggers (20260526) and the `products_spawn_default_unit` safety net (20260522). The base unit's label/price live only in `product_units` (base = `conversion_to_base = 1.0`). `saveInventory` owns the base-unit row lifecycle: inserts it on product creation (slug `<name-slug>-<id8>`), updates label/price on inline edit, and surfaces `unique (product_id, label)` collisions as row errors instead of the old trigger's silent skip. The inline inventory editor's unit/price fields are unchanged UX — only their write target moved. Base-unit re-designation (changing which unit is base) remains #208 and out of scope here.

---
