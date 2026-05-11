-- Restore qty_available on every product by adding back what was ordered in
-- the most recent prior week. With DEC-012's optimistic decrement model,
-- this reverses last week's customer demand and yields the starting
-- inventory level Annabel had set at the top of last week.
--
-- security invoker: runs as the calling role (authenticated admin).
-- The admin_all_products / admin_all_orders / admin_all_order_items
-- policies (each FOR ALL TO authenticated) cover the reads and update.

create or replace function public.prepopulate_inventory_from_last_week()
returns table(product_id uuid, added_qty integer)
language sql
security invoker
set search_path = public
as $$
  with last_week as (
    select max(week_of) as week_of
    from public.orders
    where week_of < current_date
  ),
  totals as (
    select oi.product_id, sum(oi.qty)::int as ordered_qty
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    cross join last_week lw
    where lw.week_of is not null and o.week_of = lw.week_of
    group by oi.product_id
  ),
  updated as (
    update public.products p
    set qty_available = p.qty_available + t.ordered_qty,
        updated_at = now()
    from totals t
    where t.product_id = p.id
    returning p.id, t.ordered_qty
  )
  select id, ordered_qty from updated;
$$;

grant execute on function public.prepopulate_inventory_from_last_week() to authenticated;
