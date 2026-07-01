begin;
select plan(32);

-- ============================================================
-- #211 / DEC-039 + #226 / DEC-041 — additive orders on the
-- open-order identity model.
--
-- Verifies the post-DEC-041 contract:
--   - first submission creates the customer's OPEN order (appended =
--     false); later submissions APPEND order_items to it (appended =
--     true) — at most one open orders row per customer (partial
--     unique index orders_one_open_per_customer).
--   - a replay of an already-applied submission_id is a no-op: same
--     order_id back, no new items, no double decrement — including a
--     replay whose order has since gone terminal.
--   - appending to a confirmed/ready order resets status to 'new'
--     (re-enters the pipeline).
--   - a terminal order (picked_up/delivered, DEC-044) drops out of
--     the identity: the next submission CREATES a fresh open order,
--     leaving the fulfilled one untouched.
--   - the DEC-036 soldout reject + multi-line atomicity hold on the
--     append path exactly as on the create path.
-- ============================================================

-- Fresh fixture rows scoped to this test (rolled back at end-of-file).
insert into public.customers (id, name, token)
values ('ee390000-0000-0000-0000-000000000001'::uuid, 'Additive Customer', 'token-additive-039');

-- Second customer for the foreign-submission_id scoping check.
insert into public.customers (id, name, token)
values ('ee390000-0000-0000-0000-000000000002'::uuid, 'Other Customer', 'token-additive-039-b');

-- DEC-037: unit rows are inserted explicitly (nothing spawns them).
insert into public.products (id, name, qty_available, sort_order, category)
values ('ee390000-0000-0000-0000-aaaa00000001'::uuid, 'Add Basil', 20.00, 1, 'Herbs');

insert into public.product_units (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
values ('ee390000-0000-0000-0000-bbbb00000001'::uuid,
        'ee390000-0000-0000-0000-aaaa00000001'::uuid,
        'bunch', 1, 500, true, 'add-basil-ee390000', 0);

-- In-stock product for the foreign-submission_id scoping check (it runs
-- after Add Basil has been driven oversold-negative, so B needs its own stock).
insert into public.products (id, name, qty_available, sort_order, category)
values ('ee390000-0000-0000-0000-aaaa00000003'::uuid, 'Add Scope', 5.00, 3, 'Herbs');

insert into public.product_units (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
values ('ee390000-0000-0000-0000-bbbb00000003'::uuid,
        'ee390000-0000-0000-0000-aaaa00000003'::uuid,
        'bunch', 1, 400, true, 'add-scope-ee390000', 0);

-- Zero-stock product for the DEC-036-on-append cases.
insert into public.products (id, name, qty_available, sort_order, category)
values ('ee390000-0000-0000-0000-aaaa00000002'::uuid, 'Add Zero Stock', 0.00, 2, 'Herbs');

insert into public.product_units (id, product_id, label, conversion_to_base, unit_price_cents, is_active, slug, sort_order)
values ('ee390000-0000-0000-0000-bbbb00000002'::uuid,
        'ee390000-0000-0000-0000-aaaa00000002'::uuid,
        'bunch', 1, 300, true, 'add-zero-stock-ee390000', 0);

-- ============================================================
-- 1–3. First submission creates the open order: appended = false,
--      one orders row, inventory decremented. week_of is a stamp,
--      not identity (DEC-041).
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
   where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid),
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
-- 4–7. (a) Second submission APPENDS to the open order: appended =
--      true, still one orders row, item count grows, inventory
--      decremented again.
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
   where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid),
  1,
  'still exactly one orders row after the append (open-order identity holds)'
);

select is(
  (select count(*)::int from public.order_items oi
   join public.orders o on o.id = oi.order_id
   where o.customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid),
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
  (select oi.order_id from public.order_items oi
   where oi.submission_id = 'ee39aaaa-0000-0000-0000-000000000002'::uuid
   limit 1),
  'replayed submission_id returns the existing order id'
);

select is(
  (select count(*)::int from public.order_items oi
   join public.orders o on o.id = oi.order_id
   where o.customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid),
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
 where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid;

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
   where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid),
  'new',
  'append resets confirmed → new'
);

update public.orders set status = 'ready'
 where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid;

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
   where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid),
  'new',
  'append resets ready → new'
);

-- ============================================================
-- 15–19. (d) DEC-041: a terminal order (picked_up) drops out of the
--        identity — the next submission CREATES a fresh open order
--        (appended = false), leaving the fulfilled order untouched.
-- ============================================================
update public.orders set status = 'picked_up'
 where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid;

create temp table s5_result as
select * from public.place_order(
  'ee390000-0000-0000-0000-000000000001'::uuid,
  '2026-06-08'::date,
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
);

select is(
  (select appended from s5_result),
  false,
  'submission against a picked_up order CREATES a new open order — appended = false'
);

select isnt(
  (select order_id from s5_result),
  (select oi.order_id from public.order_items oi
   where oi.submission_id = 'ee39aaaa-0000-0000-0000-000000000001'::uuid
   limit 1),
  'the new open order is a different row than the fulfilled one'
);

select is(
  (select count(*)::int from public.orders
   where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid),
  2,
  'two orders rows now: one picked_up, one new open'
);

select is(
  (select count(*)::int from public.order_items oi
   where oi.order_id = (select o.id from public.orders o
                        where o.customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
                          and o.status = 'picked_up')),
  4,
  'the fulfilled order''s items are untouched (still 4 from s1–s4)'
);

select is(
  (select qty_available from public.products
   where id = 'ee390000-0000-0000-0000-aaaa00000001'::uuid),
  12.00::numeric(10,2),
  'inventory decremented for the new order (13 - 1 = 12)'
);

-- ============================================================
-- 20–21. Partial unique index enforcement: a second OPEN order per
--        customer is refused at the DB level; terminal rows fall
--        outside the predicate and are allowed.
-- ============================================================
select throws_ok(
  $$ insert into public.orders (customer_id, week_of, fulfillment_type, status)
     values ('ee390000-0000-0000-0000-000000000001'::uuid, '2026-06-08'::date, 'delivery', 'new') $$,
  '23505',
  null,
  'partial unique index refuses a second open order per customer'
);

select lives_ok(
  $$ insert into public.orders (id, customer_id, week_of, fulfillment_type, status)
     values ('ee390000-0000-0000-0000-dddd00000001'::uuid,
             'ee390000-0000-0000-0000-000000000001'::uuid,
             '2026-05-25'::date, 'delivery', 'delivered') $$,
  'a terminal row is outside the index predicate — inserting one is allowed'
);

-- Remove the probe row so later counts stay legible.
delete from public.orders where id = 'ee390000-0000-0000-0000-dddd00000001'::uuid;

-- ============================================================
-- 22–23. Delivered also frees a new order (both terminal statuses
--        drop out of the identity).
-- ============================================================
update public.orders set status = 'delivered'
 where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
   and status = 'new';

select is(
  (select t.appended from public.place_order(
     'ee390000-0000-0000-0000-000000000001'::uuid,
     '2026-06-08'::date,
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
   ) t),
  false,
  'a delivered order also frees a new one — appended = false'
);

select is(
  (select count(*)::int from public.orders
   where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid),
  3,
  'three orders rows: picked_up, delivered, new open'
);

-- ============================================================
-- 24–27. (e) DEC-036 on the append path: a sold-out line rejects the
--        append; multi-line appends are atomic (the in-stock line's
--        write rolls back when a later line is sold out).
-- ============================================================
select throws_like(
  $$ select * from public.place_order(
       'ee390000-0000-0000-0000-000000000001'::uuid,
       '2026-06-08'::date,
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
       '2026-06-08'::date,
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
  11.00::numeric(10,2),
  'in-stock line in the rejected multi-line append is NOT decremented (still 11)'
);

select is(
  (select count(*)::int from public.order_items
   where submission_id = 'ee39aaaa-0000-0000-0000-000000000008'::uuid),
  0,
  'no order_items rows carry the rejected submission_id'
);

-- ============================================================
-- 28–29. Reconciliation recomputes across the whole order on append:
--        an oversold append (qty > 0 but insufficient) still goes
--        through (DEC-012) and flips needs_reconciliation.
-- ============================================================
select lives_ok(
  $$ select * from public.place_order(
       'ee390000-0000-0000-0000-000000000001'::uuid,
       '2026-06-08'::date,
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
  'oversold append (11 left, 20 ordered) is accepted (DEC-012)'
);

select is(
  (select needs_reconciliation from public.orders
   where customer_id = 'ee390000-0000-0000-0000-000000000001'::uuid
     and status = 'new'),
  true,
  'needs_reconciliation flipped true by the oversold append'
);

-- ============================================================
-- 30–31. Replay against a now-terminal order: the replay short-circuit
--     returns the order the submission originally landed on, even
--     though it has since been fulfilled — no new order, no writes —
--     and reports appended = true (the order carries items from other
--     submissions).
-- ============================================================
create temp table s1_replay as
select * from public.place_order(
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
);

select is(
  (select order_id from s1_replay),
  (select oi.order_id from public.order_items oi
   where oi.submission_id = 'ee39aaaa-0000-0000-0000-000000000001'::uuid
   limit 1),
  'replaying a submission whose order went terminal returns that order — no new order created'
);

select is(
  (select appended from s1_replay),
  true,
  'terminal replay reports appended = true (order carries other submissions'' items)'
);

-- ============================================================
-- 32. Foreign-submission_id scoping: customer B replaying customer A's
--     submission_id must NOT resolve to A's order — the replay check is
--     scoped to the customer, so B gets their own fresh order.
-- ============================================================
select isnt(
  (select t.order_id from public.place_order(
     'ee390000-0000-0000-0000-000000000002'::uuid,
     '2026-06-08'::date,
     'pickup', '', '', 'B pickup', '',
     jsonb_build_array(
       jsonb_build_object(
         'product_id',      'ee390000-0000-0000-0000-aaaa00000003'::text,
         'product_unit_id', 'ee390000-0000-0000-0000-bbbb00000003'::text,
         'qty',             1,
         'unit_price_cents', 400
       )
     ),
     'ee39aaaa-0000-0000-0000-000000000001'::uuid  -- A's submission_id
   ) t),
  (select oi.order_id from public.order_items oi
   where oi.submission_id = 'ee39aaaa-0000-0000-0000-000000000001'::uuid
   limit 1),
  'replaying another customer''s submission_id returns B''s own order, not A''s'
);

select * from finish();
rollback;
