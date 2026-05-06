-- Customers table: minimal scaffold for Phase 0.3.
-- Full data model (orders, order_items, products, etc.) lands in Phase 1.1.
-- Public token-based read policy lands in Phase 3 alongside the customer ordering flow.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_phone text,
  contact_email text,
  notification_preference text not null default 'sms'
    check (notification_preference in ('sms', 'email')),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

create index customers_token_idx on public.customers (token);

alter table public.customers enable row level security;

-- V1: any authenticated user is admin (DEC-003: Annabel only, sharable).
-- A users.is_admin flag will replace `authenticated`-checks once the users table arrives.
create policy "admin_select_customers" on public.customers
  for select to authenticated using (true);

create policy "admin_insert_customers" on public.customers
  for insert to authenticated with check (true);

create policy "admin_update_customers" on public.customers
  for update to authenticated using (true) with check (true);

create policy "admin_delete_customers" on public.customers
  for delete to authenticated using (true);
