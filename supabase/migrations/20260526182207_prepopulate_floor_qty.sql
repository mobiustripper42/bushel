-- Pre-populate qty restore: floor to a whole number.
--
-- 6.5e's unit-aware restore sums `qty * conversion_to_base` per product.
-- With fractional conversions (e.g. a "per qt" unit with conv=0.5 on a
-- pint-base product) the sum can land on a decimal like 6.25, and the
-- inline editor renders that as "6.25" in the Qty cell. Annabel wants
-- whole numbers, even if it means losing the fractional remainder.
--
-- Floor (not standard rounding) per explicit request — undercount the
-- inventory rather than overstate it.

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

  -- Step 1: restore unit prices to last week's snapshot. (Unchanged from 6.5e.)
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

  -- Step 2: per-product base-unit qty restore, floored to a whole number.
  return query
    with totals as (
      select
        oi.product_id,
        floor(sum(oi.qty::numeric * pu.conversion_to_base))::numeric(10,2) as ordered_base_qty
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
