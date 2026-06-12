begin;
select plan(24);

-- ============================================================
-- #211 / DEC-039 — additive orders: place_order appends to the
-- week's single (customer, week) order.
--
-- Verifies the post-DEC-039 contract:
--   - first submission creates the order (appended = false); later
--     submissions APPEND order_items to it (appended = true) — still
--     exactly one orders row per (customer, week).
--   - a replay of an already-applied submission_id is a no-op: same
--     order_id back, no new items, no double decrement.
--   - appending to a confirmed/ready order resets status to 'new'
--     (re-enters the pipeline); a picked-up/delivered order refuses
--     the append entirely and writes nothing.
--   - the DEC-036 soldout reject + multi-line atomicity hold on the
--     append path exactly as on the create path.
-- ============================================================

-- Fresh fixture rows scoped to this test (rolled back at end-of-file).
insert into public.customers (id, name, token)
values ('ee390000-0000-0000-0000-000000000001'::uuid, 'Additive Customer', 'token-additive-039');

-- DEC-037: unit rows are inserted explicitly (nothing spawns them).
insert into public.products (id, name, qty_available, sort_order, category)
values ('ee390000-0000-0000-0000-aaaa00000001'::uuid, 'Add Basil', 20.00, 1, 'Herbs');

insert into public.product_units (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
values ('ee390000-0000-0000-0000-bbbb00000001'::uuid,
        'ee390000-0000-0000-0000-aaaa00000001'::uuid,
        'bunch', 1, 500, true, 'add-basil-ee390000', 0);

-- Zero-stock product for the DEC-036-on-append cases.
insert into public.products (id, name, qty_available, sort_order, category)
values ('ee390000-0000-0000-0000-aaaa00000002'::uuid, 'Add Zero Stock', 0.00, 2, 'Herbs');

insert into public.product_units (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
values ('ee390000-0000-0000-0000-bbbb00000002'::uuid,
        'ee390000-0000-0000-0000-aaaa00000002'::uuid,
        'bunch', 1, 300, true, 'add-zero-stock-ee390000', 0);

-- ============================================================
-- 1–3. First submission creates the week's order: appended = false,
--      one orders row, inventory decremented.
-- ============================================================
select is(
  (select t.appended from public.place_order(
     'ee390000-0000-0000-0000-000000000001'::uuid,
     '2026-06-01'::date,
     'delivery', '123 Additive St', '', '', 'first note',
     jsonb_build_array(
       jsonb_build_object(
         'product_id',      'ee390000-0000-0000-0000-aaaa00000001'::text,
         'product_unit_id', 'ee390000-0000-0000-0000-bbbb00000001'::text,
         'qty',             2,
         'unit_price_cents', 500
       )
     ),
     'ee39aaaa-0000-0000-0000-000000000001'::uuid
   ) t),
  false,
  'first submission creates the order — appended = false'
);

select is(
  (select count(*)::int from public.orders
   where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
     and week_of = '2026-06-01'),
  1,
  'exactly one orders row after the first submission'
);

select is(
  (select qty_available from public.products
   where id = 'ee390000-0000-0000-0000-aaaa00000001'::uuid),
  18.00::numeric(10,2),
  'inventory decremented on create (20 - 2 = 18)'
);

-- ============================================================
-- 4–7. (a) Second submission APPENDS: appended = true, still one
--      orders row, item count grows, inventory decremented again.
-- ============================================================
select is(
  (select t.appended from public.place_order(
     'ee390000-0000-0000-0000-000000000001'::uuid,
     '2026-06-01'::date,
     'delivery', '123 Additive St', '', '', '',
     jsonb_build_array(
       jsonb_build_object(
         'product_id',      'ee390000-0000-0000-0000-aaaa00000001'::text,
         'product_unit_id', 'ee390000-0000-0000-0000-bbbb00000001'::text,
         'qty',             3,
         'unit_price_cents', 500
       )
     ),
     'ee39aaaa-0000-0000-0000-000000000002'::uuid
   ) t),
  true,
  'second submission appends — appended = true'
);

select is(
  (select count(*)::int from public.orders
   where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
     and week_of = '2026-06-01'),
  1,
  'still exactly one orders row after the append (unique constraint holds)'
);

select is(
  (select count(*)::int from public.order_items oi
   join public.orders o on o.id = oi.order_id
   where o.customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
     and o.week_of = '2026-06-01'),
  2,
  'append added a line item (2 total)'
);

select is(
  (select qty_available from public.products
   where id = 'ee390000-0000-0000-0000-aaaa00000001'::uuid),
  15.00::numeric(10,2),
  'inventory decremented on append (18 - 3 = 15)'
);

-- ============================================================
-- 8–10. (b) Replaying the same submission_id is a no-op: same order
--       back, no new items, no double decrement.
-- ============================================================
select is(
  (select t.order_id from public.place_order(
     'ee390000-0000-0000-0000-000000000001'::uuid,
     '2026-06-01'::date,
     'delivery', '123 Additive St', '', '', '',
     jsonb_build_array(
       jsonb_build_object(
         'product_id',      'ee390000-0000-0000-0000-aaaa00000001'::text,
         'product_unit_id', 'ee390000-0000-0000-0000-bbbb00000001'::text,
         'qty',             3,
         'unit_price_cents', 500
       )
     ),
     'ee39aaaa-0000-0000-0000-000000000002'::uuid
   ) t),
  (select id from public.orders
   where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
     and week_of = '2026-06-01'),
  'replayed submission_id returns the existing order id'
);

select is(
  (select count(*)::int from public.order_items oi
   join public.orders o on o.id = oi.order_id
   where o.customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
     and o.week_of = '2026-06-01'),
  2,
  'replay inserted no new items'
);

select is(
  (select qty_available from public.products
   where id = 'ee390000-0000-0000-0000-aaaa00000001'::uuid),
  15.00::numeric(10,2),
  'replay did not double-decrement inventory (still 15)'
);

-- ============================================================
-- 11–14. (c) Appending to a confirmed/ready order resets status to
--        'new' (re-enters Annabel's pipeline, DEC-035 Re-send covers
--        the stale confirmation SMS).
-- ============================================================
update public.orders set status = 'confirmed'
 where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
   and week_of = '2026-06-01';

select lives_ok(
  $$ select * from public.place_order(
       'ee390000-0000-0000-0000-000000000001'::uuid,
       '2026-06-01'::date,
       'delivery', '123 Additive St', '', '', '',
       jsonb_build_array(
         jsonb_build_object(
           'product_id',      'ee390000-0000-0000-0000-aaaa00000001'::text,
           'product_unit_id', 'ee390000-0000-0000-0000-bbbb00000001'::text,
           'qty',             1,
           'unit_price_cents', 500
         )
       ),
       'ee39aaaa-0000-0000-0000-000000000003'::uuid
     ) $$,
  'append to a confirmed order is accepted'
);

select is(
  (select status from public.orders
   where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
     and week_of = '2026-06-01'),
  'new',
  'append resets confirmed → new'
);

update public.orders set status = 'ready'
 where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
   and week_of = '2026-06-01';

select lives_ok(
  $$ select * from public.place_order(
       'ee390000-0000-0000-0000-000000000001'::uuid,
       '2026-06-01'::date,
       'delivery', '123 Additive St', '', '', '',
       jsonb_build_array(
         jsonb_build_object(
           'product_id',      'ee390000-0000-0000-0000-aaaa00000001'::text,
           'product_unit_id', 'ee390000-0000-0000-0000-bbbb00000001'::text,
           'qty',             1,
           'unit_price_cents', 500
         )
       ),
       'ee39aaaa-0000-0000-0000-000000000004'::uuid
     ) $$,
  'append to a ready order is accepted'
);

select is(
  (select status from public.orders
   where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
     and week_of = '2026-06-01'),
  'new',
  'append resets ready → new'
);

-- ============================================================
-- 15–18. (d) Appending to a terminal order (picked-up / delivered)
--        raises and writes nothing — the box is gone.
-- ============================================================
update public.orders set status = 'picked-up'
 where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
   and week_of = '2026-06-01';

select throws_like(
  $$ select * from public.place_order(
       'ee390000-0000-0000-0000-000000000001'::uuid,
       '2026-06-01'::date,
       'delivery', '123 Additive St', '', '', '',
       jsonb_build_array(
         jsonb_build_object(
           'product_id',      'ee390000-0000-0000-0000-aaaa00000001'::text,
           'product_unit_id', 'ee390000-0000-0000-0000-bbbb00000001'::text,
           'qty',             1,
           'unit_price_cents', 500
         )
       ),
       'ee39aaaa-0000-0000-0000-000000000005'::uuid
     ) $$,
  '%already fulfilled%',
  'append to a picked-up order is refused'
);

select is(
  (select count(*)::int from public.order_items oi
   join public.orders o on o.id = oi.order_id
   where o.customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
     and o.week_of = '2026-06-01'),
  4,
  'refused append wrote no items (still 4 from s1–s4)'
);

select is(
  (select qty_available from public.products
   where id = 'ee390000-0000-0000-0000-aaaa00000001'::uuid),
  13.00::numeric(10,2),
  'refused append did not decrement inventory (still 13)'
);

update public.orders set status = 'delivered'
 where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
   and week_of = '2026-06-01';

select throws_like(
  $$ select * from public.place_order(
       'ee390000-0000-0000-0000-000000000001'::uuid,
       '2026-06-01'::date,
       'delivery', '123 Additive St', '', '', '',
       jsonb_build_array(
         jsonb_build_object(
           'product_id',      'ee390000-0000-0000-0000-aaaa00000001'::text,
           'product_unit_id', 'ee390000-0000-0000-0000-bbbb00000001'::text,
           'qty',             1,
           'unit_price_cents', 500
         )
       ),
       'ee39aaaa-0000-0000-0000-000000000006'::uuid
     ) $$,
  '%already fulfilled%',
  'append to a delivered order is refused'
);

-- ============================================================
-- 19–22. (e) DEC-036 on the append path: a sold-out line rejects the
--        append; multi-line appends are atomic (the in-stock line's
--        write rolls back when a later line is sold out).
-- ============================================================
update public.orders set status = 'new'
 where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
   and week_of = '2026-06-01';

select throws_like(
  $$ select * from public.place_order(
       'ee390000-0000-0000-0000-000000000001'::uuid,
       '2026-06-01'::date,
       'delivery', '123 Additive St', '', '', '',
       jsonb_build_array(
         jsonb_build_object(
           'product_id',      'ee390000-0000-0000-0000-aaaa00000002'::text,
           'product_unit_id', 'ee390000-0000-0000-0000-bbbb00000002'::text,
           'qty',             1,
           'unit_price_cents', 300
         )
       ),
       'ee39aaaa-0000-0000-0000-000000000007'::uuid
     ) $$,
  '%is sold out%',
  'append of a sold-out product is rejected (DEC-036 holds on the append path)'
);

-- In-stock line FIRST so it gets inserted + decremented before the loop
-- reaches the sold-out line and raises — proving the earlier write rolls
-- back too.
select throws_like(
  $$ select * from public.place_order(
       'ee390000-0000-0000-0000-000000000001'::uuid,
       '2026-06-01'::date,
       'delivery', '123 Additive St', '', '', '',
       jsonb_build_array(
         jsonb_build_object('product_id', 'ee390000-0000-0000-0000-aaaa00000001'::text, 'product_unit_id', 'ee390000-0000-0000-0000-bbbb00000001'::text, 'qty', 1, 'unit_price_cents', 500),
         jsonb_build_object('product_id', 'ee390000-0000-0000-0000-aaaa00000002'::text, 'product_unit_id', 'ee390000-0000-0000-0000-bbbb00000002'::text, 'qty', 1, 'unit_price_cents', 300)
       ),
       'ee39aaaa-0000-0000-0000-000000000008'::uuid
     ) $$,
  '%is sold out%',
  'multi-line append with one sold-out line is rejected as a whole'
);

select is(
  (select qty_available from public.products
   where id = 'ee390000-0000-0000-0000-aaaa00000001'::uuid),
  13.00::numeric(10,2),
  'in-stock line in the rejected multi-line append is NOT decremented (still 13)'
);

select is(
  (select count(*)::int from public.order_items
   where submission_id = 'ee39aaaa-0000-0000-0000-000000000008'::uuid),
  0,
  'no order_items rows carry the rejected submission_id'
);

-- ============================================================
-- 23–24. Reconciliation recomputes across the whole order on append:
--        an oversold append (qty > 0 but insufficient) still goes
--        through (DEC-012) and flips needs_reconciliation.
-- ============================================================
select lives_ok(
  $$ select * from public.place_order(
       'ee390000-0000-0000-0000-000000000001'::uuid,
       '2026-06-01'::date,
       'delivery', '123 Additive St', '', '', '',
       jsonb_build_array(
         jsonb_build_object(
           'product_id',      'ee390000-0000-0000-0000-aaaa00000001'::text,
           'product_unit_id', 'ee390000-0000-0000-0000-bbbb00000001'::text,
           'qty',             20,
           'unit_price_cents', 500
         )
       ),
       'ee39aaaa-0000-0000-0000-000000000009'::uuid
     ) $$,
  'oversold append (13 left, 20 ordered) is accepted (DEC-012)'
);

select is(
  (select needs_reconciliation from public.orders
   where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
     and week_of = '2026-06-01'),
  true,
  'needs_reconciliation flipped true by the oversold append'
);

select * from finish();
rollback;
