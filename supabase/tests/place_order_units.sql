begin;
select plan(16);

-- ============================================================
-- 6.5d — place_order RPC under multi-unit (DEC-032)
--
-- Verifies the post-6.5d contract:
--   - place_order accepts product_unit_id per line item.
--   - order_items.unit_price_cents is snapshotted from product_units AT
--     ORDER TIME (not trusted from the payload, not retroactively updated
--     when admin edits the unit's price afterward).
--   - products.qty_available decrements by qty * conversion_to_base.
--   - Oversell still flips orders.needs_reconciliation = true.
-- ============================================================

-- Fresh fixture rows scoped to this test (rolled back at end-of-file).
insert into public.customers (id, name, token)
values ('dddd0000-0000-0000-0000-000000000001'::uuid, 'PlaceOrder Customer', 'token-place-order-65d');

insert into public.products (id, name, unit, price_cents, qty_available, sort_order, category)
values ('dddd0000-0000-0000-0000-aaaa00000001'::uuid, 'Basil', 'bunch', 350, 10.00, 1, 'Herbs');

-- Two units: bunch (base) + lb (conv=2 — one lb = 2 bunches' worth).
-- The trigger from 6.5a will have spawned a base unit on insert; we'll
-- replace that with deterministic rows for assertion stability.
delete from public.product_units where product_id = 'dddd0000-0000-0000-0000-aaaa00000001'::uuid;

insert into public.product_units (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
values
  ('dddd0000-0000-0000-0000-bbbb00000001'::uuid,
   'dddd0000-0000-0000-0000-aaaa00000001'::uuid,
   'bunch', 1, 350, true, 'basil-bunch-dddd0000', 0),
  ('dddd0000-0000-0000-0000-bbbb00000002'::uuid,
   'dddd0000-0000-0000-0000-aaaa00000001'::uuid,
   'lb', 2, 600, true, 'basil-lb-dddd0000', 1);

-- ============================================================
-- 1. Fractional decrement: order qty=2 of the lb unit (conv=2)
--    should drop qty_available by 4 (2 * 2 = 4).
-- ============================================================
select lives_ok(
  $$ select public.place_order(
       'dddd0000-0000-0000-0000-000000000001'::uuid,
       '2026-06-01'::date,
       'delivery', '123 Test St', '', '', '',
       jsonb_build_array(
         jsonb_build_object(
           'product_id',       'dddd0000-0000-0000-0000-aaaa00000001'::text,
           'product_unit_id',  'dddd0000-0000-0000-0000-bbbb00000002'::text,
           'qty',              2,
           'unit_price_cents', 999
         )
       )
     ) $$,
  'place_order accepts product_unit_id in p_items'
);

select is(
  (select qty_available from public.products
   where id = 'dddd0000-0000-0000-0000-aaaa00000001'::uuid),
  6.00::numeric(10,2),
  'qty_available decremented by qty * conversion_to_base (10 - 2*2 = 6)'
);

-- ============================================================
-- 2. unit_price_cents is snapshotted from product_units, NOT from
--    the client payload (the payload sent 999 — a value that would
--    be flagged as tampering — and the RPC should override it).
-- ============================================================
select is(
  (select unit_price_cents from public.order_items
   where product_id = 'dddd0000-0000-0000-0000-aaaa00000001'::uuid
   limit 1),
  600,
  'order_items.unit_price_cents pulled from product_units, ignoring payload value'
);

-- ============================================================
-- 3. product_unit_id persists from the payload (not the trigger fallback)
-- ============================================================
select is(
  (select product_unit_id from public.order_items
   where product_id = 'dddd0000-0000-0000-0000-aaaa00000001'::uuid
   limit 1),
  'dddd0000-0000-0000-0000-bbbb00000002'::uuid,
  'order_items.product_unit_id matches the payload (lb unit, not base)'
);

-- ============================================================
-- 4. Price snapshot survives unit-price edits after order placement.
-- ============================================================
update public.product_units
   set unit_price_cents = 99999
 where id = 'dddd0000-0000-0000-0000-bbbb00000002'::uuid;

select is(
  (select unit_price_cents from public.order_items
   where product_id = 'dddd0000-0000-0000-0000-aaaa00000001'::uuid
   limit 1),
  600,
  'order_items.unit_price_cents stays at snapshot value after unit price edit'
);

-- ============================================================
-- 5. Oversell-by-unit reconciliation. New customer + product so we get
--    a clean (customer, week) — place_order otherwise no-ops on conflict.
-- ============================================================
insert into public.customers (id, name, token)
values ('dddd0000-0000-0000-0000-000000000002'::uuid, 'Oversell Customer', 'token-oversell-65d');

insert into public.products (id, name, unit, price_cents, qty_available, sort_order, category)
values ('dddd0000-0000-0000-0000-aaaa00000002'::uuid, 'Mint', 'bunch', 250, 3.00, 2, 'Herbs');

delete from public.product_units where product_id = 'dddd0000-0000-0000-0000-aaaa00000002'::uuid;
insert into public.product_units (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
values
  ('dddd0000-0000-0000-0000-cccc00000001'::uuid,
   'dddd0000-0000-0000-0000-aaaa00000002'::uuid,
   'bunch', 1, 250, true, 'mint-bunch-dddd0000', 0),
  ('dddd0000-0000-0000-0000-cccc00000002'::uuid,
   'dddd0000-0000-0000-0000-aaaa00000002'::uuid,
   'lb', 4, 800, true, 'mint-lb-dddd0000', 1);

-- Order 2 lb of mint = 8 base units, but only 3 in stock → oversold by 5.
select lives_ok(
  $$ select public.place_order(
       'dddd0000-0000-0000-0000-000000000002'::uuid,
       '2026-06-01'::date,
       'delivery', '456 Oversell Ln', '', '', '',
       jsonb_build_array(
         jsonb_build_object(
           'product_id',       'dddd0000-0000-0000-0000-aaaa00000002'::text,
           'product_unit_id',  'dddd0000-0000-0000-0000-cccc00000002'::text,
           'qty',              2,
           'unit_price_cents', 800
         )
       )
     ) $$,
  'oversold order is accepted (DEC-012)'
);

select is(
  (select qty_available from public.products
   where id = 'dddd0000-0000-0000-0000-aaaa00000002'::uuid),
  (-5.00)::numeric(10,2),
  'oversold inventory goes negative (3 - 2*4 = -5)'
);

select is(
  (select needs_reconciliation from public.orders
   where customer_id = 'dddd0000-0000-0000-0000-000000000002'::uuid
     and week_of = '2026-06-01'),
  true,
  'orders.needs_reconciliation flipped true on oversold place_order'
);

-- ============================================================
-- 6. Single-unit regression: a product with one unit (the base) still
--    decrements as qty * 1 = qty. This guards against the multi-unit
--    code path breaking legacy single-unit orders.
-- ============================================================
insert into public.customers (id, name, token)
values ('dddd0000-0000-0000-0000-000000000003'::uuid, 'Single-Unit Customer', 'token-single-unit-65d');

insert into public.products (id, name, unit, price_cents, qty_available, sort_order, category)
values ('dddd0000-0000-0000-0000-aaaa00000003'::uuid, 'Chives', 'bunch', 200, 20.00, 3, 'Herbs');

delete from public.product_units where product_id = 'dddd0000-0000-0000-0000-aaaa00000003'::uuid;
insert into public.product_units (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
values
  ('dddd0000-0000-0000-0000-eeee00000001'::uuid,
   'dddd0000-0000-0000-0000-aaaa00000003'::uuid,
   'bunch', 1, 200, true, 'chives-bunch-dddd0000', 0);

select lives_ok(
  $$ select public.place_order(
       'dddd0000-0000-0000-0000-000000000003'::uuid,
       '2026-06-01'::date,
       'delivery', '789 Single St', '', '', '',
       jsonb_build_array(
         jsonb_build_object(
           'product_id',       'dddd0000-0000-0000-0000-aaaa00000003'::text,
           'product_unit_id',  'dddd0000-0000-0000-0000-eeee00000001'::text,
           'qty',              5,
           'unit_price_cents', 200
         )
       )
     ) $$,
  'single-unit order accepted'
);

select is(
  (select qty_available from public.products
   where id = 'dddd0000-0000-0000-0000-aaaa00000003'::uuid),
  15.00::numeric(10,2),
  'single-unit decrement is qty * 1 (20 - 5 = 15)'
);

-- ============================================================
-- 7. Missing product_unit_id falls through to the 6.5a safety-net
--    trigger (legacy callers — the trigger fills in the first active
--    unit). Decrement still uses qty * conv from the resolved unit.
-- ============================================================
insert into public.customers (id, name, token)
values ('dddd0000-0000-0000-0000-000000000004'::uuid, 'Trigger Fallback Customer', 'token-fallback-65d');

select lives_ok(
  $$ select public.place_order(
       'dddd0000-0000-0000-0000-000000000004'::uuid,
       '2026-06-01'::date,
       'delivery', '999 Fallback Rd', '', '', '',
       jsonb_build_array(
         jsonb_build_object(
           'product_id',       'dddd0000-0000-0000-0000-aaaa00000003'::text,
           'qty',              2,
           'unit_price_cents', 200
         )
       )
     ) $$,
  'payload without product_unit_id falls through to safety-net trigger'
);

select is(
  (select product_unit_id from public.order_items
   where product_id = 'dddd0000-0000-0000-0000-aaaa00000003'::uuid
     and order_id in (
       select id from public.orders
       where customer_id = 'dddd0000-0000-0000-0000-000000000004'::uuid
         and week_of = '2026-06-01'
     )),
  'dddd0000-0000-0000-0000-eeee00000001'::uuid,
  'trigger filled in product_unit_id from the first active unit'
);

-- ============================================================
-- 8. Product with NO active units + payload that omits product_unit_id
--    raises a distinct "no active units" error (not the misleading
--    "product_unit_id <NULL> does not belong to product …" path).
-- ============================================================
insert into public.customers (id, name, token)
values ('dddd0000-0000-0000-0000-000000000005'::uuid, 'No Units Customer', 'token-no-units-65d');

insert into public.products (id, name, unit, price_cents, qty_available, sort_order, category)
values ('dddd0000-0000-0000-0000-aaaa00000004'::uuid, 'Phantom', 'unit', 100, 5.00, 4, 'Herbs');

-- Wipe all units (including the trigger-spawned default) so the product
-- has zero active units, which is the case the error path covers.
delete from public.product_units where product_id = 'dddd0000-0000-0000-0000-aaaa00000004'::uuid;

select throws_like(
  $$ select public.place_order(
       'dddd0000-0000-0000-0000-000000000005'::uuid,
       '2026-06-01'::date,
       'delivery', '111 No Units Way', '', '', '',
       jsonb_build_array(
         jsonb_build_object(
           'product_id', 'dddd0000-0000-0000-0000-aaaa00000004'::text,
           'qty',        1,
           'unit_price_cents', 100
         )
       )
     ) $$,
  '%has no active units%',
  'product with zero active units raises a targeted error (not the unit-mismatch message)'
);

-- ============================================================
-- 9. DEC-036 / #132 — a product already at qty_available = 0 rejects the
--    order. Optimistic oversell (DEC-012) applies only while qty > 0; at
--    zero the whole order rolls back: inventory stays 0, no order row.
--    The product's trigger-spawned base unit means the RPC resolves a unit
--    fine, so the rejection is purely the qty=0 guard — not "no units".
-- ============================================================
insert into public.customers (id, name, token)
values ('dddd0000-0000-0000-0000-000000000006'::uuid, 'Sold Out Customer', 'token-soldout-036');

insert into public.products (id, name, unit, price_cents, qty_available, sort_order, category)
values ('dddd0000-0000-0000-0000-aaaa00000005'::uuid, 'Zero Stock', 'bunch', 300, 0.00, 5, 'Herbs');

select throws_like(
  $$ select public.place_order(
       'dddd0000-0000-0000-0000-000000000006'::uuid,
       '2026-06-01'::date,
       'delivery', '222 Soldout St', '', '', '',
       jsonb_build_array(
         jsonb_build_object(
           'product_id', 'dddd0000-0000-0000-0000-aaaa00000005'::text,
           'qty',        1,
           'unit_price_cents', 300
         )
       )
     ) $$,
  '%is sold out%',
  'place_order against a qty=0 product raises sold-out (DEC-036)'
);

select is(
  (select qty_available from public.products
   where id = 'dddd0000-0000-0000-0000-aaaa00000005'::uuid),
  0.00::numeric(10,2),
  'sold-out product stays at 0 — not driven negative (rejection rolled back the decrement)'
);

select is(
  (select count(*)::int from public.orders
   where customer_id = 'dddd0000-0000-0000-0000-000000000006'::uuid
     and week_of = '2026-06-01'),
  0,
  'no order row created — the whole transaction rolled back'
);

select * from finish();
rollback;
