-- DEC-037 (#212) — product_units becomes strictly authoritative for unit
-- label + price. This is the cleanup migration the 20260522175735 header
-- scheduled ("a follow-up migration removes them"): the 6.5b–e surfaces
-- (admin units drawer, customer picker, unit-aware place_order) have all
-- shipped, so the denormalized products.unit / products.price_cents columns
-- and the machinery that kept them in lockstep can go.
--
-- Drop order matters:
--   1. The bidirectional mirror triggers (20260526152348) — they read/write
--      the columns being dropped.
--   2. The products_spawn_default_unit safety net (20260522175735) — its body
--      reads new.unit / new.price_cents, so it must go before the columns.
--      App code (saveInventory) now owns the base product_units row lifecycle.
--   3. The columns themselves.
--
-- order_items_default_unit_trigger stays — it resolves product_unit_id from
-- product_units only and never touches the dropped columns (out of scope here).

-- ------------------------------------------------------------
-- 1. Mirror triggers + functions (20260526152348)
-- ------------------------------------------------------------
drop trigger mirror_product_to_base_unit_trigger on public.products;
drop function public.mirror_product_to_base_unit();

drop trigger mirror_base_unit_to_product_trigger on public.product_units;
drop function public.mirror_base_unit_to_product();

-- ------------------------------------------------------------
-- 2. Spawn-default-unit safety net (20260522175735)
-- ------------------------------------------------------------
drop trigger products_spawn_default_unit_trigger on public.products;
drop function public.products_spawn_default_unit();

-- ------------------------------------------------------------
-- 3. The denormalized columns
-- ------------------------------------------------------------
alter table public.products
  drop column unit,
  drop column price_cents;
