-- Multi-unit products (DEC-032, issue #151, parent #135).
--
-- Adds product_units as the source of truth for unit/label/price; each existing
-- product gets one product_units row backfilled (single-unit equivalent).
-- order_items grows a product_unit_id FK so a line can reference the specific
-- unit ordered. products.qty_available widens to numeric(10,2) for fractional
-- decrement (e.g., 0.5 lb of basil).
--
-- products.unit and products.price_cents are intentionally left in place this
-- migration — they continue to function as a fallback until 6.5b–e (admin UI,
-- customer picker, order placement) land, after which a follow-up migration
-- removes them.
--
-- Two safety-net triggers keep callers that don't yet know about product_units
-- working unchanged: products auto-spawn a default unit row, and order_items
-- inherit product_unit_id from that default if omitted. Both become no-ops
-- once 6.5b and 6.5d ship; they can be removed in the cleanup migration.

-- ------------------------------------------------------------
-- 1. product_units table
-- ------------------------------------------------------------
create table public.product_units (
  id                  uuid          not null primary key default gen_random_uuid(),
  product_id          uuid          not null references public.products(id) on delete cascade,
  label               text          not null,
  conversion_to_base  numeric(10,4) not null default 1.0 check (conversion_to_base > 0),
  unit_price_cents    integer       not null check (unit_price_cents > 0),
  is_active           boolean       not null default true,
  slug                text          not null,
  sort_order          integer,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),
  unique (product_id, label),
  unique (slug)
);

create index product_units_product_id_idx on public.product_units (product_id);
create index product_units_active_idx     on public.product_units (product_id) where is_active;

alter table public.product_units enable row level security;

create policy "public_read_product_units" on public.product_units
  for select to anon using (is_active = true);

create policy "admin_all_product_units" on public.product_units
  for all to authenticated using (true) with check (true);


-- ------------------------------------------------------------
-- 2. Backfill: one product_units row per existing product
-- ------------------------------------------------------------
-- Slug = lowercased name with non-alphanumerics collapsed to '-' and trimmed,
-- plus the first 8 chars of the product id. The id suffix guarantees
-- uniqueness even if two products share a name (which has happened in V1 —
-- e.g., "Basil (bunch)" vs "Basil (lb)" before multi-unit lands). Wave item
-- slugs land here so this is the format Wave will see.
insert into public.product_units (product_id, label, conversion_to_base, unit_price_cents, is_active, slug)
select
  id,
  unit,
  1.0,
  price_cents,
  true,
  trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
    || '-' || left(id::text, 8)
from public.products;


-- ------------------------------------------------------------
-- 3. order_items.product_unit_id (nullable → backfill → not null)
-- ------------------------------------------------------------
alter table public.order_items
  add column product_unit_id uuid references public.product_units(id) on delete restrict;

update public.order_items oi
   set product_unit_id = pu.id
  from public.product_units pu
 where pu.product_id = oi.product_id;

alter table public.order_items
  alter column product_unit_id set not null;

create index order_items_product_unit_id_idx on public.order_items (product_unit_id);


-- ------------------------------------------------------------
-- 4. products.qty_available → numeric(10,2)
-- ------------------------------------------------------------
-- Tracked in base units for fractional decrement (DEC-032).
alter table public.products
  alter column qty_available type numeric(10,2) using qty_available::numeric(10,2);


-- ------------------------------------------------------------
-- 5. Safety-net triggers (removable after 6.5b + 6.5d ship)
-- ------------------------------------------------------------

-- 5a. New products get a default product_units row (mirroring the backfill).
--     Slug appends the first 8 chars of product_id so the auto-generated slug
--     is guaranteed unique even if two products share a name (which happens
--     in test fixtures and isn't otherwise prevented). The 6.5b admin UI will
--     offer human-curated slugs; this trigger is the safety net.
create function public.products_spawn_default_unit() returns trigger as $$
begin
  insert into public.product_units (
    product_id, label, conversion_to_base, unit_price_cents, is_active, slug
  ) values (
    new.id,
    new.unit,
    1.0,
    new.price_cents,
    true,
    trim(both '-' from regexp_replace(lower(new.name), '[^a-z0-9]+', '-', 'g'))
      || '-' || left(new.id::text, 8)
  )
  on conflict (product_id, label) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger products_spawn_default_unit_trigger
  after insert on public.products
  for each row execute function public.products_spawn_default_unit();

-- 5b. order_items inserts without product_unit_id inherit from the product's
--     first active unit (the default, until callers wise up to multi-unit).
create function public.order_items_default_unit() returns trigger as $$
begin
  if new.product_unit_id is null then
    select id into new.product_unit_id
      from public.product_units
     where product_id = new.product_id and is_active = true
     order by sort_order nulls last, created_at
     limit 1;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger order_items_default_unit_trigger
  before insert on public.order_items
  for each row execute function public.order_items_default_unit();
