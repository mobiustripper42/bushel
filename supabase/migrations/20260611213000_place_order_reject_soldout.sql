-- #132 / DEC-036 — reject line items for products that are already sold out.
--
-- DEC-012 optimistic placement intentionally lets a customer oversell the
-- "last few" of a product (qty_available > 0, ordered qty pushes it negative)
-- and flags the order needs_reconciliation. DEC-031 says qty_available = 0 is
-- *truly* unavailable — the customer form greys those rows and disables the
-- stepper. But the place_order RPC applied the optimistic decrement
-- unconditionally, so a stale tab (page loaded with stock → inventory hit 0 →
-- customer submitted) could place an order against qty_available = 0, driving
-- it negative. DEC-036: optimism does NOT extend to zero.
--
-- The fix is the WHERE guard + IF NOT FOUND on the decrement UPDATE below.
-- Making it part of the UPDATE (rather than a separate SELECT … check) keeps
-- it race-free: the row is only decremented when qty_available > 0 at the
-- instant of the write, and FOUND tells us whether it applied. A raise inside
-- the loop rolls back the whole order (single transaction) — atomic, no
-- partial order, no orphaned decrement.
--
-- Everything else is byte-identical to 20260524141544_place_order_unit_aware.

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
      -- Distinct error path from the cross-product-id case below so the
      -- message points at the right remedy: re-activate (or seed) a unit
      -- on this product, not "fix the unit_id in your payload."
      if v_unit_id is null then
        raise exception 'place_order: product % has no active units', v_product_id;
      end if;
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

    -- DEC-036: optimistic oversell (DEC-012) applies only while there is
    -- stock to draw down. The `qty_available > 0` guard makes this a no-op
    -- on a sold-out product; FOUND is then false and we reject the whole
    -- order. qty_available > 0 but insufficient still decrements into the
    -- negative + flags reconciliation below — unchanged "last few" behavior.
    update public.products
       set qty_available = qty_available - (v_qty::numeric * v_conv),
           updated_at = now()
     where id = v_product_id and qty_available > 0;

    if not found then
      raise exception 'place_order: product % is sold out', v_product_id
        using errcode = 'P0001';
    end if;
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
