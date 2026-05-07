-- Initial schema baseline for bushel (Bay Branch Farm Inventory & Order System).
-- Squashes the Phase 0.3 customers scaffold into a single clean migration.
-- Designed per docs/SCHEMA.md (Phase 1.1a).
--
-- week_of convention: Monday of the order week in America/New_York.
-- Compute in app as: date_trunc('week', now() AT TIME ZONE 'America/New_York')::date
-- App is Ohio-only; DST handled automatically by the IANA tz database.

-- Drop stale Phase 0.3 customers table if it exists on remote (dev only — no real data).
drop table if exists public.customers cascade;


-- ------------------------------------------------------------
-- codes — single lookup table for all configurable reference values
-- ------------------------------------------------------------
create table public.codes (
  type        text not null,
  code        text not null,
  label       text not null,
  sort_order  integer,
  primary key (type, code)
);

insert into public.codes (type, code, label, sort_order) values
  ('fulfillment_type', 'delivery',   'Delivery',   1),
  ('fulfillment_type', 'pickup',     'Pickup',      2),
  ('order_status',     'new',        'New',         1),
  ('order_status',     'ready',      'Ready',       2),
  ('order_status',     'picked_up',  'Picked Up',   3),
  ('order_status',     'delivered',  'Delivered',   4);


-- ------------------------------------------------------------
-- users — admin role flag; mirrors auth.users via trigger
-- ------------------------------------------------------------
create table public.users (
  id         uuid        not null primary key references auth.users(id) on delete cascade,
  is_admin   boolean     not null default false,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;


-- ------------------------------------------------------------
-- products — weekly catalog; qty_available decremented on order (DEC-012)
-- ------------------------------------------------------------
create table public.products (
  id             uuid        not null primary key default gen_random_uuid(),
  name           text        not null,
  description    text,
  unit           text        not null,
  price_cents    integer     not null check (price_cents > 0),
  qty_available  integer     not null default 0,
  -- qty_available allows negative (optimistic oversell, DEC-012).
  -- Forgetting to set qty triggers needs_reconciliation on every order until corrected.
  is_available   boolean     not null default true,
  sort_order     integer,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.products enable row level security;


-- ------------------------------------------------------------
-- customers — B2B; authenticate via token URL, not Supabase Auth (DEC-004)
-- ------------------------------------------------------------
create table public.customers (
  id                      uuid        not null primary key default gen_random_uuid(),
  name                    text        not null,
  business_name           text,
  phone                   text,
  email                   text,
  -- DEC-020: kept as CHECK constraint rather than codes table entry to ease v2 email expansion.
  notification_preference text        not null default 'sms'
    check (notification_preference in ('sms', 'email', 'none')),
  token                   text        not null unique,
  delivery_address        text,
  is_active               boolean     not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index customers_token_idx on public.customers (token);

alter table public.customers enable row level security;

-- Placeholder admin policies (service-role-as-gate, RLS-as-backstop pattern lands in 1.2).
create policy "admin_select_customers" on public.customers
  for select to authenticated using (true);
create policy "admin_insert_customers" on public.customers
  for insert to authenticated with check (true);
create policy "admin_update_customers" on public.customers
  for update to authenticated using (true) with check (true);
create policy "admin_delete_customers" on public.customers
  for delete to authenticated using (true);


-- ------------------------------------------------------------
-- pickup_windows — 4 fixed windows per week (DEC-013)
-- ------------------------------------------------------------
create table public.pickup_windows (
  id          uuid        not null primary key default gen_random_uuid(),
  label       text        not null,
  -- label is informational only; day_of_week/start_time/end_time are authoritative.
  day_of_week smallint    not null check (day_of_week between 0 and 6),
  start_time  time        not null,
  end_time    time        not null,
  is_active   boolean     not null default true,
  sort_order  integer,
  created_at  timestamptz not null default now()
);

alter table public.pickup_windows enable row level security;


-- ------------------------------------------------------------
-- ordering_schedule — singleton config row (DEC-011)
-- Phase 4b wires the cron that reads is_open and flips it on schedule.
-- ------------------------------------------------------------
create table public.ordering_schedule (
  id                  uuid        not null primary key default gen_random_uuid(),
  -- is_singleton enforces exactly one row; app must always UPDATE, never INSERT.
  is_singleton        boolean     not null default true unique check (is_singleton = true),
  is_open             boolean     not null default false,
  weekly_open_day     smallint    check (weekly_open_day between 0 and 6),
  weekly_open_time    time,
  weekly_close_day    smallint    check (weekly_close_day between 0 and 6),
  weekly_close_time   time,
  override_closes_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

insert into public.ordering_schedule (is_open) values (false);

alter table public.ordering_schedule enable row level security;


-- ------------------------------------------------------------
-- orders — one per customer per week
-- ------------------------------------------------------------
create table public.orders (
  id                    uuid        not null primary key default gen_random_uuid(),
  customer_id           uuid        not null references public.customers(id) on delete restrict,
  -- week_of: Monday of the order week in America/New_York (see file header).
  week_of               date        not null,
  -- fulfillment_type references codes(type='fulfillment_type'); app-enforced, no DB FK.
  fulfillment_type      text        not null default 'delivery',
  pickup_window_id      uuid        references public.pickup_windows(id) on delete restrict,
  -- pickup_window_id required when fulfillment_type = 'pickup'; enforced app-side in V1.
  delivery_address      text,
  -- status references codes(type='order_status'); app-enforced, no DB FK.
  status                text        not null default 'new',
  needs_reconciliation  boolean     not null default false,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (customer_id, week_of)
);

create index orders_customer_id_idx          on public.orders (customer_id);
create index orders_week_of_idx              on public.orders (week_of);
create index orders_needs_reconciliation_idx on public.orders (needs_reconciliation)
  where needs_reconciliation = true;

alter table public.orders enable row level security;


-- ------------------------------------------------------------
-- order_items — line items; qty is integer (denomination via products.unit)
-- ------------------------------------------------------------
create table public.order_items (
  id               uuid        not null primary key default gen_random_uuid(),
  order_id         uuid        not null references public.orders(id) on delete cascade,
  product_id       uuid        not null references public.products(id) on delete restrict,
  qty              integer     not null check (qty > 0),
  unit_price_cents integer     not null check (unit_price_cents > 0),
  created_at       timestamptz not null default now()
);

create index order_items_order_id_idx   on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

alter table public.order_items enable row level security;
