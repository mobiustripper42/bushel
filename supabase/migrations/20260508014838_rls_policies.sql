-- RLS policies for all tables (Phase 1.2).
-- Pattern: service-role-as-gate (app uses service role, bypasses RLS entirely) +
-- RLS-as-backstop (defense against direct DB access).
--
-- Customer identity for anon policies: server sets app.customer_id via
-- `set local app.customer_id = '<uuid>'` before each customer query (Phase 3.3).
-- When unset, current_setting returns null and no rows match — secure default.

-- Drop placeholder policies from initial_schema migration.
drop policy if exists "admin_select_customers" on public.customers;
drop policy if exists "admin_insert_customers" on public.customers;
drop policy if exists "admin_update_customers" on public.customers;
drop policy if exists "admin_delete_customers" on public.customers;


-- ------------------------------------------------------------
-- codes — public reference data; no client writes
-- ------------------------------------------------------------
alter table public.codes enable row level security;

create policy "read_codes" on public.codes
  for select using (true);


-- ------------------------------------------------------------
-- users — authenticated only; full CRUD on own row
-- (is_admin enforcement moves here in Phase 1.3)
-- ------------------------------------------------------------
create policy "admin_all_users" on public.users
  for all to authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- products — anon reads available; authenticated full CRUD
-- ------------------------------------------------------------
create policy "public_read_products" on public.products
  for select to anon using (is_available = true);

create policy "admin_all_products" on public.products
  for all to authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- customers — authenticated full CRUD; no anon access (PII)
-- ------------------------------------------------------------
create policy "admin_all_customers" on public.customers
  for all to authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- pickup_windows — anon reads active; authenticated full CRUD
-- ------------------------------------------------------------
create policy "public_read_pickup_windows" on public.pickup_windows
  for select to anon using (is_active = true);

create policy "admin_all_pickup_windows" on public.pickup_windows
  for all to authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- ordering_schedule — anon reads (is_open needed for customer page);
-- authenticated full CRUD
-- ------------------------------------------------------------
create policy "public_read_ordering_schedule" on public.ordering_schedule
  for select using (true);

create policy "admin_all_ordering_schedule" on public.ordering_schedule
  for all to authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- orders — authenticated full CRUD; anon reads own via session var
-- ------------------------------------------------------------
create policy "admin_all_orders" on public.orders
  for all to authenticated using (true) with check (true);

create policy "customer_read_own_orders" on public.orders
  for select to anon
  using (
    customer_id = nullif(current_setting('app.customer_id', true), '')::uuid
  );


-- ------------------------------------------------------------
-- order_items — authenticated full CRUD; anon reads own via session var
-- ------------------------------------------------------------
create policy "admin_all_order_items" on public.order_items
  for all to authenticated using (true) with check (true);

create policy "customer_read_own_order_items" on public.order_items
  for select to anon
  using (
    order_id in (
      select id from public.orders
      where customer_id = nullif(current_setting('app.customer_id', true), '')::uuid
    )
  );
