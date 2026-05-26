-- Pre-populate revisited: overwrite-only, qty-only.
--
-- Two changes from the 6.5e + floor-qty body:
--
-- 1. Drop the unit-price restore. Annabel decided pre-populate should
--    affect quantity only — restoring prices was scope creep that made
--    the action surprising (price you set on Monday could revert when
--    you hit Pre-pop on Tuesday).
--
-- 2. Overwrite, don't add. The previous body added last week's ordered
--    total to current qty, so two clicks doubled the result and any
--    leftover stock from the current week leaked into "last week's
--    starting inventory." The new body SETs every product's qty:
--    products ordered last week get last week's total (floored);
--    products not ordered get 0. Idempotent — click N times, same
--    answer.
--
-- Return shape unchanged. Only products with a non-zero last-week total
-- come back in the result set, so the action's "Restored qty on N
-- products" message reflects products that actually had orders, not
-- the noisy "we touched all 12".

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

  return query
  with last_week as (
    select
      oi.product_id,
      floor(sum(oi.qty::numeric * pu.conversion_to_base))::numeric(10,2)
        as ordered_base_qty
    from public.order_items oi
    join public.orders o          on o.id = oi.order_id
    join public.product_units pu  on pu.id = oi.product_unit_id
    where o.week_of = v_last_week
    group by oi.product_id
  ),
  updated as (
    update public.products p
       set qty_available = coalesce(lw.ordered_base_qty, 0),
           updated_at    = now()
      from public.products p2
      left join last_week lw on lw.product_id = p2.id
     where p.id = p2.id
       and p.qty_available is distinct from coalesce(lw.ordered_base_qty, 0)
    returning p.id, lw.ordered_base_qty
  )
  select id, ordered_base_qty
    from updated
   where ordered_base_qty is not null;
end;
$$;

grant execute on function public.prepopulate_inventory_from_last_week() to authenticated;
