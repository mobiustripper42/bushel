-- Phase 3.5 — optimistic order placement (closes #50, DEC-012).
--
-- Wraps the customer-side order submission in one plpgsql function so the
-- orders insert, order_items insert, and products.qty_available decrement
-- all run in a single transaction. Inventory is allowed to go negative
-- (oversell); when it does, orders.needs_reconciliation is flipped true
-- so the admin sees it later. The unique (customer_id, week_of) constraint
-- on orders is the natural double-submit guard — a second call returns
-- the existing order's id rather than raising, so the action can redirect
-- to /confirmed cleanly either way.

create or replace function public.place_order(
  p_customer_id          uuid,
  p_week_of              date,
  p_fulfillment_type     text,
  p_delivery_address     text,
  p_delivery_preference  text,
  p_pickup_note          text,
  p_notes                text,
  p_items                jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order_id     uuid;
  v_item         jsonb;
  v_negative     boolean;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'place_order: p_items must be a non-empty json array';
  end if;

  -- Atomic double-submit handling. Two concurrent calls with the same
  -- (customer_id, week_of) both reach this insert; the loser silently
  -- no-ops via ON CONFLICT, then we fall through to fetch the winner's id.
  -- A naive select-then-insert has a TOCTOU window that propagates a
  -- unique_violation to the caller on a fast double-tap.
  insert into public.orders (
    customer_id, week_of, fulfillment_type,
    delivery_address, delivery_preference, pickup_note,
    notes, status, needs_reconciliation
  )
  values (
    p_customer_id, p_week_of, p_fulfillment_type,
    p_delivery_address, p_delivery_preference, p_pickup_note,
    p_notes, 'new', false
  )
  on conflict (customer_id, week_of) do nothing
  returning id into v_order_id;

  if v_order_id is null then
    -- Conflict: an order already exists for this customer + week. Return
    -- its id so the caller can redirect to /confirmed unchanged.
    select id into v_order_id
    from public.orders
    where customer_id = p_customer_id and week_of = p_week_of;
    return v_order_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (order_id, product_id, qty, unit_price_cents)
    values (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'qty')::int,
      (v_item->>'unit_price_cents')::int
    );

    update public.products
       set qty_available = qty_available - (v_item->>'qty')::int,
           updated_at = now()
     where id = (v_item->>'product_id')::uuid;
  end loop;

  -- Flip needs_reconciliation if any product touched by this order is now
  -- negative. Cheaper to compute once at the end than per-item.
  select exists (
    select 1
    from public.products p
    join public.order_items oi on oi.product_id = p.id
    where oi.order_id = v_order_id
      and p.qty_available < 0
  ) into v_negative;

  if v_negative then
    update public.orders
       set needs_reconciliation = true
     where id = v_order_id;
  end if;

  return v_order_id;
end;
$$;

-- The server action calls this via the service-role client, which bypasses RLS
-- entirely. anon and authenticated have no execute grant.
revoke all on function public.place_order(uuid, date, text, text, text, text, text, jsonb) from public;
grant execute on function public.place_order(uuid, date, text, text, text, text, text, jsonb) to service_role;
