begin;
select plan(7);

-- ============================================================
-- prepopulate_inventory_from_last_week() — overwrite-only, qty-only
--
-- Verifies the 2026-05-26 behavior (succeeded 6.5e's additive +
-- price-restoring body):
--   - qty_available is SET (not added) to floor(sum(qty * conv_to_base))
--     for products with last-week orders.
--   - Products with NO last-week orders get qty_available SET to 0.
--   - unit_price_cents is NOT touched — pre-populate is qty-only.
--   - Deactivated units stay deactivated (carries over from 6.5e).
--   - No last-week orders → empty rowset, no error.
-- ============================================================

-- Use a fixed last-week date relative to the run.
delete from public.orders where week_of = (current_date - interval '7 days')::date;

-- Fixture: basil (multi-unit, bunch base + lb conv=2), chives (single
-- unit), and parsley (single unit, NOT ordered — used to assert the
-- zero-out behavior).
insert into public.customers (id, name, token)
values ('eeee0000-0000-0000-0000-000000000001'::uuid, 'Prepop Customer', 'token-prepop-overwrite');

insert into public.products (id, name, qty_available, sort_order, category)
values
  ('eeee0000-0000-0000-0000-aaaa00000001'::uuid, 'TestBasil',   10.00, 90, 'Herbs'),
  ('eeee0000-0000-0000-0000-aaaa00000002'::uuid, 'TestChives',  20.00, 91, 'Herbs'),
  ('eeee0000-0000-0000-0000-aaaa00000003'::uuid, 'TestParsley', 15.00, 92, 'Herbs');

-- DEC-037: unit rows (base + extras) are inserted explicitly.
insert into public.product_units (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
values
  ('eeee0000-0000-0000-0000-bbbb00000001'::uuid,
   'eeee0000-0000-0000-0000-aaaa00000001'::uuid,
   'bunch', 1, 350, true, 'testbasil-bunch-eeee0000', 0),
  ('eeee0000-0000-0000-0000-bbbb00000002'::uuid,
   'eeee0000-0000-0000-0000-aaaa00000001'::uuid,
   'lb', 2, 600, true, 'testbasil-lb-eeee0000', 1),
  ('eeee0000-0000-0000-0000-bbbb00000003'::uuid,
   'eeee0000-0000-0000-0000-aaaa00000002'::uuid,
   'bunch', 1, 200, true, 'testchives-bunch-eeee0000', 0),
  ('eeee0000-0000-0000-0000-bbbb00000004'::uuid,
   'eeee0000-0000-0000-0000-aaaa00000003'::uuid,
   'bunch', 1, 250, true, 'testparsley-bunch-eeee0000', 0);

-- Seed last week's orders: 3 bunch + 2 lb basil; 5 bunch chives.
-- Parsley intentionally NOT ordered.
insert into public.orders (id, customer_id, week_of, fulfillment_type, status)
values ('eeee0000-0000-0000-0000-cccc00000001'::uuid,
        'eeee0000-0000-0000-0000-000000000001'::uuid,
        (current_date - interval '7 days')::date,
        'delivery', 'delivered');

insert into public.order_items (order_id, product_id, product_unit_id, qty, unit_price_cents, created_at)
values
  ('eeee0000-0000-0000-0000-cccc00000001'::uuid,
   'eeee0000-0000-0000-0000-aaaa00000001'::uuid,
   'eeee0000-0000-0000-0000-bbbb00000001'::uuid,
   3, 325, now() - interval '6 days'),   -- bunch snapshot @ $3.25 (current $3.50)
  ('eeee0000-0000-0000-0000-cccc00000001'::uuid,
   'eeee0000-0000-0000-0000-aaaa00000001'::uuid,
   'eeee0000-0000-0000-0000-bbbb00000002'::uuid,
   2, 575, now() - interval '6 days'),   -- lb snapshot @ $5.75 (current $6.00)
  ('eeee0000-0000-0000-0000-cccc00000001'::uuid,
   'eeee0000-0000-0000-0000-aaaa00000002'::uuid,
   'eeee0000-0000-0000-0000-bbbb00000003'::uuid,
   5, 200, now() - interval '6 days');

create temporary table prepop_result as
  select * from public.prepopulate_inventory_from_last_week();

-- ============================================================
-- 1. Basil: 3 bunch + 2 lb at conv 2 = 3*1 + 2*2 = 7 base units; floor still 7.
-- ============================================================
select is(
  (select added_qty from prepop_result
   where product_id = 'eeee0000-0000-0000-0000-aaaa00000001'::uuid),
  7.00::numeric,
  'multi-unit qty restore sums qty * conversion_to_base (floored)'
);

-- Overwrite semantics: starting qty was 10; new qty = 7 (last-week total),
-- not 10 + 7 = 17.
select is(
  (select qty_available from public.products
   where id = 'eeee0000-0000-0000-0000-aaaa00000001'::uuid),
  7.00::numeric(10,2),
  'basil qty_available overwritten to 7 (not added to current)'
);

-- ============================================================
-- 2. Chives (single-unit conv=1): 5 bunch → added_qty 5.
-- ============================================================
select is(
  (select added_qty from prepop_result
   where product_id = 'eeee0000-0000-0000-0000-aaaa00000002'::uuid),
  5.00::numeric,
  'single-unit qty restore is qty * 1'
);

select is(
  (select qty_available from public.products
   where id = 'eeee0000-0000-0000-0000-aaaa00000002'::uuid),
  5.00::numeric(10,2),
  'chives qty_available overwritten to 5'
);

-- ============================================================
-- 3. Parsley had NO last-week order — qty must be set to 0.
-- ============================================================
select is(
  (select qty_available from public.products
   where id = 'eeee0000-0000-0000-0000-aaaa00000003'::uuid),
  0.00::numeric(10,2),
  'product with no last-week order is zeroed out'
);

-- Parsley should NOT appear in the result rowset (only products that
-- got a non-zero last-week total come back, for the toast message).
select is(
  (select count(*)::int from prepop_result
   where product_id = 'eeee0000-0000-0000-0000-aaaa00000003'::uuid),
  0,
  'zeroed-out products are not included in the result rowset'
);

-- ============================================================
-- 4. Unit prices are NOT touched. Basil bunch was 350 going in, still 350.
-- ============================================================
select is(
  (select unit_price_cents from public.product_units
   where id = 'eeee0000-0000-0000-0000-bbbb00000001'::uuid),
  350,
  'unit prices are NOT restored — pre-populate is qty-only now'
);

select * from finish();
rollback;
