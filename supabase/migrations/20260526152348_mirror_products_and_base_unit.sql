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

-- ------------------------------------------------------------
-- A. products UPDATE → base product_units row
-- ------------------------------------------------------------
create or replace function public.mirror_product_to_base_unit() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.unit is distinct from old.unit
     or new.price_cents is distinct from old.price_cents then
    update public.product_units
       set label            = new.unit,
           unit_price_cents = new.price_cents
     where product_id           = new.id
       and conversion_to_base   = 1.0
       and (label            is distinct from new.unit
            or unit_price_cents is distinct from new.price_cents);
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

-- Bring any pre-existing drift into alignment now. Pick products as the
-- starting source for the backfill — that's what the inline editor has been
-- writing to, so it's likely the most recently-edited value Annabel saw.
update public.product_units pu
   set label            = p.unit,
       unit_price_cents = p.price_cents
  from public.products p
 where pu.product_id         = p.id
   and pu.conversion_to_base = 1.0
   and (pu.label            is distinct from p.unit
        or pu.unit_price_cents is distinct from p.price_cents);
