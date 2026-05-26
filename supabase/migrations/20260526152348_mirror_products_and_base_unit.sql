-- #174 follow-up: long-term, product_units should be the single source of
-- truth for label + price. Today products.unit / products.price_cents are
-- still read by legacy fallback paths (admin orders, customer form), and the
-- inline inventory editor writes to them directly. Without a sync, a drawer
-- edit to the base unit's label/price doesn't reach products.*, and an
-- inline price edit doesn't reach product_units.* — drift either way.
--
-- Two minimal triggers keep them in lockstep. Each trigger no-ops if the
-- target already matches, which also kills any cascade: A updates B → B's
-- trigger sees matching values → exits without re-updating A.
--
-- Concurrent-writer deadlock window: T1 updates products (locks P) → fires
-- A → locks PU. T2 simultaneously updates the base product_units row
-- (locks PU) → fires B → waits on P. Postgres detects and aborts one
-- transaction; no data corruption. With a single admin + customers that
-- write only to orders/order_items, this isn't a realistic path today.
-- Worth re-checking if a background job ever starts touching products.

-- ------------------------------------------------------------
-- A. products UPDATE → base product_units row
-- ------------------------------------------------------------
-- Price always mirrors. Label only mirrors if the target label isn't
-- already taken by another (non-base) unit row on the same product —
-- the unique (product_id, label) constraint would otherwise fail the
-- whole UPDATE on the products side. Existing drift cases (real prod
-- data on 2026-05-26 had at least one) need manual resolution; the
-- trigger silently skips the label mirror to keep saves working.
create or replace function public.mirror_product_to_base_unit() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.price_cents is distinct from old.price_cents then
    update public.product_units
       set unit_price_cents = new.price_cents
     where product_id         = new.id
       and conversion_to_base = 1.0
       and unit_price_cents   is distinct from new.price_cents;
  end if;
  if new.unit is distinct from old.unit then
    update public.product_units
       set label = new.unit
     where product_id         = new.id
       and conversion_to_base = 1.0
       and label              is distinct from new.unit
       and not exists (
         select 1 from public.product_units sib
          where sib.product_id = new.id
            and sib.label      = new.unit
            and sib.conversion_to_base <> 1.0
       );
  end if;
  return new;
end;
$$;

create trigger mirror_product_to_base_unit_trigger
  after update of unit, price_cents on public.products
  for each row execute function public.mirror_product_to_base_unit();

-- ------------------------------------------------------------
-- B. base product_units row UPDATE → products row
-- ------------------------------------------------------------
create or replace function public.mirror_base_unit_to_product() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- Only the base unit mirrors back. Non-base unit edits are independent.
  if new.conversion_to_base <> 1.0 then
    return new;
  end if;
  if new.label is distinct from old.label
     or new.unit_price_cents is distinct from old.unit_price_cents then
    update public.products
       set unit        = new.label,
           price_cents = new.unit_price_cents
     where id = new.product_id
       and (unit        is distinct from new.label
            or price_cents is distinct from new.unit_price_cents);
  end if;
  return new;
end;
$$;

create trigger mirror_base_unit_to_product_trigger
  after update of label, unit_price_cents, conversion_to_base
  on public.product_units
  for each row execute function public.mirror_base_unit_to_product();

-- Intentionally no backfill: prod data on 2026-05-26 had at least one
-- product whose products.unit clashed with a non-base unit's label, and
-- a blind UPDATE collides with the (product_id, label) unique constraint.
-- Going forward the triggers keep new edits aligned; existing drift needs
-- per-row resolution. Surface offenders with:
--
--   select p.id, p.name, p.unit  as products_unit,
--          pu.label as base_label, pu.unit_price_cents
--     from public.products p
--     join public.product_units pu
--       on pu.product_id = p.id and pu.conversion_to_base = 1.0
--    where p.unit is distinct from pu.label
--       or p.price_cents is distinct from pu.unit_price_cents;
