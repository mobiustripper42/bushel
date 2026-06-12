-- #208 (DEC-038) — change which product_units row is a product's base unit.
--
-- The base unit is the row with conversion_to_base = 1.0 (DEC-037). Re-basing
-- is an invariant-preserving rescale: divide EVERY unit's conversion_to_base
-- AND products.qty_available (stored in base units) by the new base's current
-- conversion, atomically. The new base lands at exactly 1.0; every other unit
-- rescales by the same factor.
--
-- Why this preserves order math: order_items store qty in the ordered unit and
-- read conversion live from product_units, so a line's base-unit footprint is
-- qty * conversion_to_base. Dividing all conversions and qty_available by the
-- same factor rescales both sides of every comparison identically — physical
-- stock, oversold state, and reconciliation flags are all unchanged.
--
-- Unit PRICES are per-unit ("$6 per lb" is true regardless of what we count
-- stock in) and are intentionally untouched.
--
-- The function also renumbers sort_order so the new base sorts first — the
-- customer order form defaults to units[0] (sorted by sort_order nulls last,
-- created_at), so "make base" doubles as "make this the customer default."

create function public.set_base_unit(
  p_product_id        uuid,
  p_new_base_unit_id  uuid
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_old_conv   numeric(10,4);
  v_is_active  boolean;
begin
  select conversion_to_base, is_active
    into v_old_conv, v_is_active
    from public.product_units
   where id = p_new_base_unit_id
     and product_id = p_product_id;

  if v_old_conv is null then
    raise exception 'set_base_unit: unit % does not belong to product %',
      p_new_base_unit_id, p_product_id;
  end if;

  if not v_is_active then
    raise exception 'set_base_unit: unit % is inactive — it cannot be the base unit',
      p_new_base_unit_id;
  end if;

  -- Already the base — nothing to rescale, nothing to reorder.
  if v_old_conv = 1.0 then
    return;
  end if;

  -- Rescale every unit's conversion by the same factor. The new base becomes
  -- round(v_old_conv / v_old_conv, 4) = exactly 1.0000.
  update public.product_units
     set conversion_to_base = round(conversion_to_base / v_old_conv, 4),
         updated_at = now()
   where product_id = p_product_id;

  -- qty_available is stored in base units, so it rescales by the same factor.
  update public.products
     set qty_available = round(qty_available / v_old_conv, 2),
         updated_at = now()
   where id = p_product_id;

  -- Renumber sort_order deterministically: new base first (0), then the rest
  -- in their current display order (sort_order nulls last, created_at) — the
  -- same order the customer form and admin drawer sort by.
  with ordered as (
    select id,
           row_number() over (
             order by (id = p_new_base_unit_id) desc,
                      sort_order nulls last,
                      created_at
           ) - 1 as new_order
      from public.product_units
     where product_id = p_product_id
  )
  update public.product_units pu
     set sort_order = o.new_order
    from ordered o
   where pu.id = o.id;
end;
$$;

-- security invoker: callers go through product_units/products RLS (admin "all"
-- policies for authenticated). Same grant pattern as the other admin-facing
-- function (prepopulate_inventory_from_last_week), plus service_role for
-- test/ops tooling — revoking from public drops its default execute too.
revoke all on function public.set_base_unit(uuid, uuid) from public;
grant execute on function public.set_base_unit(uuid, uuid) to authenticated;
grant execute on function public.set_base_unit(uuid, uuid) to service_role;
