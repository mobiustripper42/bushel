begin;
select plan(50);

-- ============================================================
-- Schema sanity: RLS enabled on all tables
-- ============================================================
select is(
  (select relrowsecurity from pg_class where oid = 'public.codes'::regclass),
  true, 'RLS enabled on codes'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.users'::regclass),
  true, 'RLS enabled on users'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.products'::regclass),
  true, 'RLS enabled on products'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.ordering_schedule'::regclass),
  true, 'RLS enabled on ordering_schedule'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.orders'::regclass),
  true, 'RLS enabled on orders'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.order_items'::regclass),
  true, 'RLS enabled on order_items'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.customer_sends'::regclass),
  true, 'RLS enabled on customer_sends'
);

-- ============================================================
-- Schema sanity: Phase 2.0a columns
-- ============================================================
select col_not_null('public', 'products', 'category', 'products.category is not null');
select col_has_default('public', 'products', 'category', 'products.category has a default');
select col_not_null('public', 'customers', 'send_weekly_link', 'customers.send_weekly_link is not null');
select col_has_default('public', 'customers', 'send_weekly_link', 'customers.send_weekly_link has a default');

-- ============================================================
-- Schema sanity: Phase 3.0 columns
-- ============================================================
select has_column('public', 'customers', 'priority', 'customers.priority column exists');
select col_not_null('public', 'customers', 'priority', 'customers.priority is not null');
select col_default_is('public', 'customers', 'priority', '100', 'customers.priority defaults to 100');

-- ============================================================
-- Schema sanity: Phase 2.0b fulfillment columns (DEC-029 + DEC-030)
-- ============================================================
select has_column('public', 'orders', 'pickup_note', 'orders.pickup_note column exists (DEC-029)');
select col_type_is('public', 'orders', 'pickup_note', 'text', 'orders.pickup_note is text');
select has_column('public', 'orders', 'delivery_preference', 'orders.delivery_preference column exists (DEC-029)');
select col_type_is('public', 'orders', 'delivery_preference', 'text', 'orders.delivery_preference is text');
select col_default_is('public', 'ordering_schedule', 'is_open', 'true', 'ordering_schedule.is_open defaults to true (DEC-030)');

-- ============================================================
-- Schema sanity: Phase 4.2 send-queue (DEC-026)
-- ============================================================
select has_column('public', 'ordering_schedule', 'intro_note', 'ordering_schedule.intro_note column exists (DEC-026)');
select col_type_is('public', 'ordering_schedule', 'intro_note', 'text', 'ordering_schedule.intro_note is text');
select has_table('public', 'customer_sends', 'customer_sends table exists (DEC-026)');
select has_column('public', 'customer_sends', 'sent_at', 'customer_sends.sent_at column exists');

-- ============================================================
-- Seed test data (postgres role bypasses RLS)
-- ============================================================
insert into public.customers (id, name, token) values
  ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Customer A', 'token-a'),
  ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'Customer B', 'token-b');

insert into public.products (id, name, qty_available, is_available) values
  ('bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'Kale', 10, true),
  ('bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'Hidden Item', 5, false);

-- DEC-037: base product_units rows are inserted explicitly (no spawn trigger).
-- The order_items inserts below omit product_unit_id and rely on the
-- order_items_default_unit trigger resolving these rows.
insert into public.product_units (product_id, label, conversion_to_base, unit_price_cents, is_active, slug) values
  ('bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'bunch', 1.0, 300, true, 'kale-bbbbbbbb'),
  ('bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'each',  1.0, 500, true, 'hidden-item-bbbbbbbb');

insert into public.orders (id, customer_id, week_of, fulfillment_type, status) values
  ('dddddddd-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid, '2026-05-04', 'delivery', 'new'),
  ('dddddddd-0000-0000-0000-000000000002'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000002'::uuid, '2026-05-04', 'delivery', 'new');

insert into public.order_items (order_id, product_id, qty, unit_price_cents) values
  ('dddddddd-0000-0000-0000-000000000001'::uuid,
   'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 2, 300),
  ('dddddddd-0000-0000-0000-000000000002'::uuid,
   'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 1, 300);

-- ============================================================
-- codes
-- ============================================================
set local role anon;
select isnt_empty($$ select * from public.codes $$, 'anon can read codes');
reset role;

set local role authenticated;
select isnt_empty($$ select * from public.codes $$, 'authenticated can read codes');
reset role;

-- ============================================================
-- products
-- ============================================================
set local role anon;
select isnt_empty(
  $$ select * from public.products where is_available = true $$,
  'anon can read available products'
);
select is_empty(
  $$ select * from public.products where is_available = false $$,
  'anon cannot read unavailable products'
);
select throws_ok(
  $$ insert into public.products (name) values ('X') $$,
  '42501', null, 'anon cannot insert products'
);
reset role;

set local role authenticated;
select isnt_empty($$ select * from public.products $$, 'authenticated can read all products');
select lives_ok(
  $$ insert into public.products (name, qty_available)
     values ('Test Product', 5) $$,
  'authenticated can insert products'
);
reset role;

-- ============================================================
-- ordering_schedule
-- ============================================================
set local role anon;
select isnt_empty($$ select * from public.ordering_schedule $$, 'anon can read ordering_schedule');
-- UPDATE with no matching policy silently affects 0 rows; verify value is unchanged
update public.ordering_schedule set is_open = false;
select is(
  (select is_open from public.ordering_schedule),
  true,
  'anon cannot update ordering_schedule (value unchanged after attempt)'
);
reset role;

set local role authenticated;
select lives_ok(
  $$ update public.ordering_schedule set is_open = false $$,
  'authenticated can update ordering_schedule'
);
reset role;

-- ============================================================
-- customers
-- ============================================================
set local role anon;
select is_empty($$ select * from public.customers $$, 'anon cannot read customers');
select throws_ok(
  $$ insert into public.customers (name, token) values ('X', 'token-x') $$,
  '42501', null, 'anon cannot insert customers'
);
reset role;

set local role authenticated;
select isnt_empty($$ select * from public.customers $$, 'authenticated can read customers');
reset role;

-- ============================================================
-- orders — customer self-read via app.customer_id session var
-- ============================================================
set local role anon;

-- No session var set: cannot read any orders
select is_empty(
  $$ select * from public.orders $$,
  'anon with no session var cannot read orders'
);

-- Session var set to Customer A: can read only their order
select set_config('app.customer_id', 'aaaaaaaa-0000-0000-0000-000000000001', true);
select is(
  (select count(*)::int from public.orders),
  1,
  'anon with customer_id sees only their own orders'
);
select is(
  (select customer_id from public.orders limit 1),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'anon sees correct customer order'
);

-- Cannot insert orders directly
select throws_ok(
  $$ insert into public.orders (customer_id, week_of, fulfillment_type, status)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-05-11', 'delivery', 'new') $$,
  '42501', null, 'anon cannot insert orders'
);

reset role;

-- Authenticated sees all orders
set local role authenticated;
select is(
  (select count(*)::int from public.orders),
  2,
  'authenticated can read all orders'
);
reset role;

-- ============================================================
-- order_items — customer self-read follows their orders
-- ============================================================
set local role anon;

select set_config('app.customer_id', 'aaaaaaaa-0000-0000-0000-000000000001', true);
select is(
  (select count(*)::int from public.order_items),
  1,
  'anon with customer_id sees only their own order_items'
);

select set_config('app.customer_id', '', true);
select is_empty(
  $$ select * from public.order_items $$,
  'anon with no session var cannot read order_items'
);

reset role;

-- Cross-customer isolation: Customer B sees only their own order_items
set local role anon;
select set_config('app.customer_id', 'aaaaaaaa-0000-0000-0000-000000000002', true);
select is(
  (select count(*)::int from public.order_items),
  1,
  'anon as Customer B sees only their own order_items'
);
select is(
  (select order_id from public.order_items limit 1),
  'dddddddd-0000-0000-0000-000000000002'::uuid,
  'anon as Customer B sees correct order_item'
);

reset role;

set local role authenticated;
select is(
  (select count(*)::int from public.order_items),
  2,
  'authenticated can read all order_items'
);
reset role;

-- ============================================================
-- customer_sends — admin-only (DEC-026 send-queue state)
-- ============================================================
set local role anon;
select is_empty(
  $$ select * from public.customer_sends $$,
  'anon cannot read customer_sends'
);
select throws_ok(
  $$ insert into public.customer_sends (customer_id, week_of, mode)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-05-11', 'weekly_update') $$,
  '42501', null, 'anon cannot insert customer_sends'
);
reset role;

set local role authenticated;
select lives_ok(
  $$ insert into public.customer_sends (customer_id, week_of, mode)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-05-11', 'weekly_update') $$,
  'authenticated can insert customer_sends (valid mode)'
);
select throws_ok(
  $$ insert into public.customer_sends (customer_id, week_of, mode)
     values ('aaaaaaaa-0000-0000-0000-000000000002', '2026-05-11', 'invalid_mode') $$,
  '23514', null, 'customer_sends.mode CHECK rejects invalid mode'
);
reset role;

select * from finish();
rollback;
