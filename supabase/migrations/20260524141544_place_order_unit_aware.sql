-- Phase 6.5d — unit-aware place_order RPC (closes #154, DEC-032).
--
-- Replaces the place_order function from 20260514173354 with a body that:
--   1. Reads product_unit_id per item from the payload (optional — legacy
--      callers without it still work because the 6.5a safety-net trigger
--      on order_items fills in the first active unit).
--   2. Snapshots unit_price_cents from product_units at order time. The
--      payload's unit_price_cents is ignored — strict "matches the unit's
--      price at the moment of order" semantics, no client-tamper surface.
--   3. Decrements products.qty_available by qty * conversion_to_base
--      instead of just qty. For single-unit products (conv=1) this is
--      identical to the prior behavior.
--
-- Signature is unchanged — the JSONB shape inside p_items grew an optional
-- product_unit_id field, but the function arguments themselves are the same.

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
  v_product_id   uuid;
  v_unit_id      uuid;
  v_qty          int;
  v_unit_price   int;
  v_conv         numeric(10,4);
  v_negative     boolean;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'place_order: p_items must be a non-empty json array';
  end if;

  -- Atomic double-submit handling. See prior migration's comment block for
  -- the TOCTOU rationale (20260514173354_place_order_function.sql).
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
    select id into v_order_id
    from public.orders
    where customer_id = p_customer_id and week_of = p_week_of;
    return v_order_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty        := (v_item->>'qty')::int;
    -- product_unit_id is optional in the payload. When absent, the
    -- order_items_default_unit BEFORE-INSERT trigger (from 6.5a) fills
    -- in the first active unit for this product. We resolve the unit
    -- here too so the price snapshot + decrement math match what the
    -- row will end up with.
    v_unit_id := nullif(v_item->>'product_unit_id', '')::uuid;
    if v_unit_id is null then
      select id into v_unit_id
        from public.product_units
       where product_id = v_product_id and is_active = true
       order by sort_order nulls last, created_at
       limit 1;
    end if;

    -- Snapshot from product_units, not from the client payload. If a unit
    -- id was supplied but doesn't belong to this product (mismatched),
    -- the lookup returns null and we raise — refusing to record a
    -- cross-product unit reference rather than silently falling through.
    select unit_price_cents, conversion_to_base
      into v_unit_price, v_conv
      from public.product_units
     where id = v_unit_id and product_id = v_product_id;

    if v_unit_price is null then
      raise exception
        'place_order: product_unit_id % does not belong to product %', v_unit_id, v_product_id;
    end if;

    insert into public.order_items (order_id, product_id, product_unit_id, qty, unit_price_cents)
    values (v_order_id, v_product_id, v_unit_id, v_qty, v_unit_price);

    update public.products
       set qty_available = qty_available - (v_qty::numeric * v_conv),
           updated_at = now()
     where id = v_product_id;
  end loop;

  -- Flip needs_reconciliation if any product touched by this order is now
  -- negative. Same one-shot check as the prior version.
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

-- Re-apply grants. CREATE OR REPLACE preserves the prior REVOKE/GRANT state
-- when the signature is unchanged, but it's cheap to be explicit so a future
-- hand-edit doesn't accidentally widen access.
revoke all on function public.place_order(uuid, date, text, text, text, text, text, jsonb) from public;
grant execute on function public.place_order(uuid, date, text, text, text, text, text, jsonb) to service_role;
