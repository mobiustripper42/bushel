-- Phase 6.5e — unit-aware pre-populate (closes #155, DEC-032).
--
-- Two changes to prepopulate_inventory_from_last_week():
--
-- 1. Inventory restore is now unit-aware. Pre-6.5d, the function summed
--    oi.qty per product — fine when every line item was 1 base unit. Post-
--    6.5d, ordering 2 lb of basil (conv=2) decremented qty_available by 4,
--    but the old restore only added back 2. New body multiplies by
--    product_units.conversion_to_base so the math reverses cleanly.
--
-- 2. Unit prices restored to last-week snapshot. For each product_unit
--    that appears in any last-week order_items row, update its
--    unit_price_cents to the value recorded on the most recent (by
--    created_at) last-week line item referencing that unit. Units that
--    weren't ordered last week are left alone. Re-activation of
--    deactivated units is NOT in scope — flipping is_active back to true
--    on a unit Annabel deliberately deactivated mid-week would silently
--    undo admin intent (see 6.5e plan).
--
-- The function return shape widens from added_qty integer → numeric to
-- match products.qty_available's numeric(10,2). Callers using data.length
-- (the action does) are unaffected.

drop function if exists public.prepopulate_inventory_from_last_week();

create or replace function public.prepopulate_inventory_from_last_week()
returns table(product_id uuid, added_qty numeric)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_last_week date;
begin
  select max(week_of) into v_last_week
    from public.orders
   where week_of < current_date;

  if v_last_week is null then
    return;
  end if;

  -- Step 1: restore unit prices to last week's snapshot. Done before the
  -- qty restore so a hand-rolled trigger on product_units (none exists
  -- today, but defensive) wouldn't see the qty change first and react.
  with last_week_unit_orders as (
    select
      oi.product_unit_id,
      oi.unit_price_cents,
      row_number() over (
        partition by oi.product_unit_id
        order by oi.created_at desc, oi.id desc
      ) as rn
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.week_of = v_last_week
  )
  update public.product_units pu
     set unit_price_cents = lw.unit_price_cents,
         updated_at = now()
    from last_week_unit_orders lw
   where lw.product_unit_id = pu.id
     and lw.rn = 1
     and pu.unit_price_cents is distinct from lw.unit_price_cents;

  -- Step 2: per-product base-unit qty restore. Multiplies each line's qty
  -- by its unit's conversion_to_base — the inverse of 6.5d's decrement.
  return query
    with totals as (
      select
        oi.product_id,
        sum(oi.qty::numeric * pu.conversion_to_base)::numeric(10,2) as ordered_base_qty
      from public.order_items oi
      join public.orders o          on o.id = oi.order_id
      join public.product_units pu  on pu.id = oi.product_unit_id
      where o.week_of = v_last_week
      group by oi.product_id
    ),
    updated as (
      update public.products p
         set qty_available = p.qty_available + t.ordered_base_qty,
             updated_at = now()
        from totals t
       where t.product_id = p.id
      returning p.id, t.ordered_base_qty
    )
    select id, ordered_base_qty from updated;
end;
$$;

grant execute on function public.prepopulate_inventory_from_last_week() to authenticated;
