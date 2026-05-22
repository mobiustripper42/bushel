begin;
select plan(28);

-- ============================================================
-- Schema sanity (migration 20260522175735_multi_unit_products)
-- ============================================================
select has_table('public', 'product_units', 'product_units table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.product_units'::regclass),
  true, 'RLS enabled on product_units'
);
select has_column('public', 'product_units', 'product_id',         'product_units.product_id exists');
select has_column('public', 'product_units', 'label',              'product_units.label exists');
select has_column('public', 'product_units', 'conversion_to_base', 'product_units.conversion_to_base exists');
select has_column('public', 'product_units', 'unit_price_cents',   'product_units.unit_price_cents exists');
select has_column('public', 'product_units', 'is_active',          'product_units.is_active exists');
select has_column('public', 'product_units', 'slug',               'product_units.slug exists');
select has_column('public', 'order_items',   'product_unit_id',    'order_items.product_unit_id exists (DEC-032)');
select col_not_null('public', 'order_items', 'product_unit_id',    'order_items.product_unit_id is NOT NULL');
select col_type_is('public', 'products', 'qty_available', 'numeric(10,2)', 'products.qty_available widened to numeric(10,2)');

-- ============================================================
-- Backfill: every pre-existing product got exactly one product_units row
-- ============================================================
select is(
  (select count(*)::int from public.products),
  (select count(distinct product_id)::int from public.product_units),
  'backfill produced one product_units row per existing product'
);

-- ============================================================
-- FK enforcement on order_items.product_unit_id
-- ============================================================
insert into public.customers (id, name, token)
values ('cccccccc-aaaa-0000-0000-000000000001'::uuid, 'FK Customer', 'token-fk');

insert into public.orders (id, customer_id, week_of, fulfillment_type, status)
values ('cccccccc-bbbb-0000-0000-000000000001'::uuid,
        'cccccccc-aaaa-0000-0000-000000000001'::uuid,
        '2026-05-11', 'delivery', 'new');

select throws_ok(
  $$ insert into public.order_items (order_id, product_id, qty, unit_price_cents, product_unit_id)
     values ('cccccccc-bbbb-0000-0000-000000000001'::uuid,
             (select id from public.products limit 1),
             1, 100,
             '99999999-9999-9999-9999-999999999999'::uuid) $$,
  '23503', null, 'order_items.product_unit_id FK rejects unknown unit id'
);

-- ============================================================
-- conversion_to_base > 0 check
-- ============================================================
select throws_ok(
  $$ insert into public.product_units (product_id, label, conversion_to_base, unit_price_cents, slug)
     values ((select id from public.products limit 1), 'bad', 0, 100, 'bad-zero') $$,
  '23514', null, 'product_units.conversion_to_base must be > 0'
);

-- ============================================================
-- Safety-net trigger: new product spawns a default unit row
-- ============================================================
insert into public.products (id, name, unit, price_cents, qty_available, is_available)
values ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'Test Multi Unit Item', 'each', 250, 7, true);

select is(
  (select count(*)::int from public.product_units
    where product_id = 'eeeeeeee-0000-0000-0000-000000000001'::uuid),
  1,
  'product_units auto-spawned for newly inserted product'
);

select is(
  (select label from public.product_units
    where product_id = 'eeeeeeee-0000-0000-0000-000000000001'::uuid),
  'each',
  'auto-spawned unit copies products.unit'
);

select is(
  (select unit_price_cents from public.product_units
    where product_id = 'eeeeeeee-0000-0000-0000-000000000001'::uuid),
  250,
  'auto-spawned unit copies products.price_cents'
);

select is(
  (select conversion_to_base from public.product_units
    where product_id = 'eeeeeeee-0000-0000-0000-000000000001'::uuid),
  1.0::numeric(10,4),
  'auto-spawned unit has conversion_to_base = 1.0'
);

select is(
  (select slug from public.product_units
    where product_id = 'eeeeeeee-0000-0000-0000-000000000001'::uuid),
  'test-multi-unit-item-eeeeeeee',
  'auto-spawned unit slug = name-slug + product-id prefix'
);

-- ============================================================
-- Safety-net trigger: order_items inherits product_unit_id
-- ============================================================
insert into public.customers (id, name, token)
values ('ffffffff-0000-0000-0000-000000000001'::uuid, 'Multi Unit Customer', 'token-mu');

insert into public.orders (id, customer_id, week_of, fulfillment_type, status)
values ('eeeeeeee-1111-0000-0000-000000000001'::uuid,
        'ffffffff-0000-0000-0000-000000000001'::uuid,
        '2026-05-11', 'delivery', 'new');

-- Insert WITHOUT product_unit_id; trigger should inherit from default unit.
insert into public.order_items (order_id, product_id, qty, unit_price_cents)
values ('eeeeeeee-1111-0000-0000-000000000001'::uuid,
        'eeeeeeee-0000-0000-0000-000000000001'::uuid,
        2, 250);

select isnt(
  (select product_unit_id from public.order_items
    where order_id = 'eeeeeeee-1111-0000-0000-000000000001'::uuid),
  null,
  'order_items.product_unit_id auto-filled by trigger'
);

select is(
  (select pu.product_id from public.order_items oi
     join public.product_units pu on pu.id = oi.product_unit_id
    where oi.order_id = 'eeeeeeee-1111-0000-0000-000000000001'::uuid),
  'eeeeeeee-0000-0000-0000-000000000001'::uuid,
  'auto-filled product_unit_id belongs to the right product'
);

-- ============================================================
-- products.qty_available accepts fractional values
-- ============================================================
update public.products
   set qty_available = 3.5
 where id = 'eeeeeeee-0000-0000-0000-000000000001'::uuid;

select is(
  (select qty_available from public.products
    where id = 'eeeeeeee-0000-0000-0000-000000000001'::uuid),
  3.5::numeric(10,2),
  'products.qty_available stores fractional values (3.5)'
);

-- ============================================================
-- RLS — anon
-- ============================================================
-- Mark one unit inactive so we can verify the active-only filter.
insert into public.product_units (product_id, label, conversion_to_base, unit_price_cents, is_active, slug)
values ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'inactive-unit', 0.5, 500, false, 'test-multi-unit-item-inactive');

set local role anon;
select isnt_empty(
  $$ select * from public.product_units where is_active = true $$,
  'anon can read active product_units'
);
select is_empty(
  $$ select * from public.product_units where is_active = false $$,
  'anon cannot read inactive product_units'
);
select throws_ok(
  $$ insert into public.product_units (product_id, label, unit_price_cents, slug)
     values ('eeeeeeee-0000-0000-0000-000000000001', 'x', 100, 'x-x') $$,
  '42501', null, 'anon cannot insert product_units'
);
reset role;

set local role authenticated;
select isnt_empty(
  $$ select * from public.product_units $$,
  'authenticated can read all product_units (active + inactive)'
);
select lives_ok(
  $$ insert into public.product_units (product_id, label, unit_price_cents, slug)
     values ('eeeeeeee-0000-0000-0000-000000000001', 'pound', 600, 'test-multi-unit-item-pound') $$,
  'authenticated can insert product_units'
);
reset role;

-- ============================================================
-- Cascade: deleting a product wipes its product_units rows
-- ============================================================
delete from public.order_items where product_id = 'eeeeeeee-0000-0000-0000-000000000001'::uuid;
delete from public.products where id = 'eeeeeeee-0000-0000-0000-000000000001'::uuid;
select is(
  (select count(*)::int from public.product_units
    where product_id = 'eeeeeeee-0000-0000-0000-000000000001'::uuid),
  0,
  'deleting a product cascades to its product_units rows'
);

select * from finish();
rollback;
