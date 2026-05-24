begin;
select plan(9);

-- ============================================================
-- 6.5e — prepopulate_inventory_from_last_week() under multi-unit
--
-- Verifies post-6.5e behavior:
--   - qty restore is unit-aware (qty * conversion_to_base).
--   - unit_price_cents on each ordered unit reverts to last week's
--     snapshot (the most-recent order_items.unit_price_cents).
--   - Units NOT ordered last week have their prices left alone.
--   - Single-unit (conv=1) products are unchanged from the old math.
--   - No last-week orders → function returns empty rowset, no error.
-- ============================================================

-- Use a fixed last-week date relative to the run so the function picks it up.
-- The function checks week_of < current_date and takes max(week_of).
-- All test orders go in current_date - 7 days; nothing else in that week.
-- Clear any pre-existing orders in that week to avoid pollution from seed data.
delete from public.orders where week_of = (current_date - interval '7 days')::date;

-- Fixture: basil (multi-unit, bunch base + lb conv=2) + chives (single).
insert into public.customers (id, name, token)
values ('eeee0000-0000-0000-0000-000000000001'::uuid, 'Prepop Customer', 'token-prepop-65e');

insert into public.products (id, name, unit, price_cents, qty_available, sort_order, category)
values
  ('eeee0000-0000-0000-0000-aaaa00000001'::uuid, 'TestBasil',  'bunch', 350, 10.00, 90, 'Herbs'),
  ('eeee0000-0000-0000-0000-aaaa00000002'::uuid, 'TestChives', 'bunch', 200, 20.00, 91, 'Herbs');

-- Replace trigger-spawned units with deterministic ones.
delete from public.product_units where product_id in (
  'eeee0000-0000-0000-0000-aaaa00000001'::uuid,
  'eeee0000-0000-0000-0000-aaaa00000002'::uuid
);

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
   'bunch', 1, 200, true, 'testchives-bunch-eeee0000', 0);

-- Seed last week's orders: 3 bunch + 2 lb basil; 5 bunch chives.
insert into public.orders (id, customer_id, week_of, fulfillment_type, status)
values ('eeee0000-0000-0000-0000-cccc00000001'::uuid,
        'eeee0000-0000-0000-0000-000000000001'::uuid,
        (current_date - interval '7 days')::date,
        'delivery', 'delivered');

-- Manually insert order_items with snapshot prices (different from current
-- product_units prices for the price-restore assertion).
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
   5, 200, now() - interval '6 days');   -- chives snapshot @ $2.00 (current $2.00)

-- Capture pre-restore state so we can assert the deltas.
-- Run the function and capture its rowset.
create temporary table prepop_result as
  select * from public.prepopulate_inventory_from_last_week();

-- ============================================================
-- 1. Basil: 3 bunch + 2 lb at conv 2 = 3*1 + 2*2 = 7 base units added.
-- ============================================================
select is(
  (select added_qty from prepop_result
   where product_id = 'eeee0000-0000-0000-0000-aaaa00000001'::uuid),
  7.00::numeric,
  'multi-unit qty restore sums qty * conversion_to_base'
);

select is(
  (select qty_available from public.products
   where id = 'eeee0000-0000-0000-0000-aaaa00000001'::uuid),
  17.00::numeric(10,2),
  'basil qty_available bumped 10 + 7 = 17'
);

-- ============================================================
-- 2. Chives (single-unit conv=1): 5 bunch → added_qty 5, unchanged math.
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
  25.00::numeric(10,2),
  'chives qty_available bumped 20 + 5 = 25'
);

-- ============================================================
-- 3. Price restore: basil bunch + lb reverted to last week's snapshot.
-- ============================================================
select is(
  (select unit_price_cents from public.product_units
   where id = 'eeee0000-0000-0000-0000-bbbb00000001'::uuid),
  325,
  'basil bunch unit_price_cents restored to last-week snapshot ($3.25)'
);

select is(
  (select unit_price_cents from public.product_units
   where id = 'eeee0000-0000-0000-0000-bbbb00000002'::uuid),
  575,
  'basil lb unit_price_cents restored to last-week snapshot ($5.75)'
);

-- ============================================================
-- 4. Unit that didn't have a last-week order keeps its current price.
-- Seed a new unit AFTER the orders existed; it shouldn't be touched.
-- ============================================================
insert into public.product_units (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
values ('eeee0000-0000-0000-0000-bbbb00000004'::uuid,
        'eeee0000-0000-0000-0000-aaaa00000002'::uuid,
        'pinch', 0.25, 50, true, 'testchives-pinch-eeee0000', 1);

-- Re-invoke; discard the returned rowset. The first call already touched
-- units that had last-week orders; this second call is about asserting
-- that a unit added AFTER last week's orders is left alone.
create temporary table prepop_result_2 as
  select * from public.prepopulate_inventory_from_last_week();

select is(
  (select unit_price_cents from public.product_units
   where id = 'eeee0000-0000-0000-0000-bbbb00000004'::uuid),
  50,
  'unit with no last-week order keeps its current price (untouched)'
);

-- ============================================================
-- 4b. Deactivated unit invariant: a unit that's been turned off
--     by admin (is_active = false) stays deactivated even when it
--     had last-week orders. Pins the 6.5e scope decision NOT to
--     silently re-enable units that Annabel deliberately disabled.
-- ============================================================
update public.product_units
   set is_active = false
 where id = 'eeee0000-0000-0000-0000-bbbb00000002'::uuid;  -- basil lb

-- Run pre-populate again. The lb unit had a last-week order, so its
-- price would update if it were reactivated. is_active must NOT change.
create temporary table prepop_result_3 as
  select * from public.prepopulate_inventory_from_last_week();

select is(
  (select is_active from public.product_units
   where id = 'eeee0000-0000-0000-0000-bbbb00000002'::uuid),
  false,
  'deactivated unit stays deactivated through pre-populate (6.5e scope pin)'
);

-- ============================================================
-- 5. No last-week orders → function returns empty rowset, no error.
-- Wipe last-week orders and call again.
-- ============================================================
delete from public.orders where week_of = (current_date - interval '7 days')::date;

-- Also need to wipe anything else in any prior week so max(week_of) is null.
delete from public.orders where week_of < current_date;

select is(
  (select count(*)::int from public.prepopulate_inventory_from_last_week()),
  0,
  'no prior-week orders → function returns empty rowset (no exception)'
);

select * from finish();
rollback;
