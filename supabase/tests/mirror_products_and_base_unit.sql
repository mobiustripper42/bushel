begin;
select plan(7);

-- ============================================================
-- products ↔ base product_units mirror triggers.
--
-- Covers the bidirectional sync added in
-- 20260526152348_mirror_products_and_base_unit.sql:
--   A. UPDATE on products mirrors unit/price_cents → base unit row.
--   B. UPDATE on base product_units row mirrors label/unit_price_cents
--      → products columns.
--   C. Label mirror in direction A skips when another (non-base) unit
--      on the same product already owns that label (the unique
--      (product_id, label) constraint would otherwise fail the whole
--      products UPDATE). Price still mirrors.
-- ============================================================

-- Fixture: standalone test product with a base unit. The
-- products_spawn_default_unit trigger seeds the base unit on INSERT.
insert into public.products (id, name, unit, price_cents, qty_available, sort_order, category)
values ('ffff0000-0000-0000-0000-aaaa00000001'::uuid, 'TestMirror', 'bunch', 300, 10.00, 99, 'Herbs');

-- ============================================================
-- A. products UPDATE → base unit
-- ============================================================
update public.products
   set unit = 'pile', price_cents = 425
 where id = 'ffff0000-0000-0000-0000-aaaa00000001'::uuid;

select is(
  (select label from public.product_units
   where product_id = 'ffff0000-0000-0000-0000-aaaa00000001'::uuid
     and conversion_to_base = 1.0),
  'pile',
  'products.unit update mirrors to base unit label'
);

select is(
  (select unit_price_cents from public.product_units
   where product_id = 'ffff0000-0000-0000-0000-aaaa00000001'::uuid
     and conversion_to_base = 1.0),
  425,
  'products.price_cents update mirrors to base unit unit_price_cents'
);

-- ============================================================
-- B. product_units UPDATE (base) → products
-- ============================================================
update public.product_units
   set label = 'bunch', unit_price_cents = 350
 where product_id = 'ffff0000-0000-0000-0000-aaaa00000001'::uuid
   and conversion_to_base = 1.0;

select is(
  (select unit from public.products
   where id = 'ffff0000-0000-0000-0000-aaaa00000001'::uuid),
  'bunch',
  'base unit label update mirrors to products.unit'
);

select is(
  (select price_cents from public.products
   where id = 'ffff0000-0000-0000-0000-aaaa00000001'::uuid),
  350,
  'base unit price update mirrors to products.price_cents'
);

-- Sanity: A non-base unit update must NOT mirror back to products.
insert into public.product_units (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
values ('ffff0000-0000-0000-0000-bbbb00000001'::uuid,
        'ffff0000-0000-0000-0000-aaaa00000001'::uuid,
        'pound', 2.0, 700, true, 'testmirror-pound-ffff0000', 1);

update public.product_units
   set label = 'lb', unit_price_cents = 750
 where id = 'ffff0000-0000-0000-0000-bbbb00000001'::uuid;

select is(
  (select unit from public.products
   where id = 'ffff0000-0000-0000-0000-aaaa00000001'::uuid),
  'bunch',
  'non-base unit update does NOT mirror to products.unit'
);

-- ============================================================
-- C. Label mirror skips on collision; price still mirrors.
-- A non-base "lb" unit exists. Set products.unit = 'lb' — the label
-- mirror MUST skip (collision with the non-base row) but the price
-- mirror must still run.
-- ============================================================
update public.products
   set unit = 'lb', price_cents = 900
 where id = 'ffff0000-0000-0000-0000-aaaa00000001'::uuid;

select is(
  (select label from public.product_units
   where product_id = 'ffff0000-0000-0000-0000-aaaa00000001'::uuid
     and conversion_to_base = 1.0),
  'bunch',
  'label mirror skipped — another unit on this product owns "lb"'
);

select is(
  (select unit_price_cents from public.product_units
   where product_id = 'ffff0000-0000-0000-0000-aaaa00000001'::uuid
     and conversion_to_base = 1.0),
  900,
  'price mirror still ran even though label mirror skipped'
);

select * from finish();
rollback;
