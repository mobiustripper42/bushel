-- #211 / DEC-039 — additive orders: append to the week's single order.
--
-- Model B: a customer can submit ADDITIONAL items while ordering is open.
-- Additions append order_items rows to the existing (customer, week) order —
-- the `unique (customer_id, week_of)` constraint STAYS (one order row per
-- customer per week, so customer_sends keying, maybeSingle() reads, and the
-- 1:1 admin sends join all hold).
--
-- What changes here:
--
-- 1. order_items.submission_id — a client-generated per-submit-attempt UUID.
--    It replaces the old ON CONFLICT no-op as the double-submit guard: a
--    replay of an already-applied submission short-circuits (returns the
--    existing order, no insert, no decrement). It doubles as a per-submission
--    audit trail — every line carries which submit attempt created it.
--    Nullable: historical rows (pre-DEC-039) stay null.
--
-- 2. place_order grows a trailing `p_submission_id uuid` parameter and now
--    RETURNS TABLE(order_id uuid, appended boolean) instead of bare uuid.
--    `appended` tells the caller whether this submission created the week's
--    order (false) or appended to an existing one (true) so the action can
--    pick the right alert copy. RETURNS TABLE chosen over OUT params for a
--    self-describing shape in the generated TS types; chosen over a second
--    lookup in the action to keep "did this append?" race-free (only the
--    function, inside its transaction, knows).
--
-- 3. Append semantics:
--    - terminal guard: appending to a 'picked-up'/'delivered' order raises —
--      the box is already gone.
--    - status reset: appending to a 'confirmed'/'ready' order resets it to
--      'new' so it re-enters Annabel's pipeline (the now-stale confirmation
--      SMS is covered by the existing Re-send affordance). A 'new' order's
--      status is untouched; terminal is guarded above.
--    - notes: a non-empty p_notes on an append is concatenated onto the
--      existing orders.notes with a " — " separator, never overwritten.
--    - fulfillment fields are NOT touched on append (DEC-015: customers
--      don't edit fulfillment; change = text Annabel).
--    - per-item loop (unit resolution, price snapshot, DEC-036 soldout
--      reject, optimistic decrement) is byte-equivalent to
--      20260611213000_place_order_reject_soldout.sql, plus submission_id on
--      each inserted row.
--    - needs_reconciliation recomputes across ALL the order's items (the
--      existing union-over-the-order query already does this).

alter table public.order_items
  add column submission_id uuid;

comment on column public.order_items.submission_id is
  'Client-generated per-submit-attempt UUID (DEC-039). Idempotency key for '
  'place_order — a replayed submission is a no-op returning the existing '
  'order — and per-submission audit (which submit attempt created this line). '
  'Null on rows that predate additive orders.';

create index order_items_submission_id_idx
  on public.order_items (submission_id);

-- Signature change (8 args → 9) requires dropping the old overload explicitly;
-- CREATE OR REPLACE would otherwise leave both callable and PostgREST RPC
-- resolution ambiguous.
drop function if exists public.place_order(uuid, date, text, text, text, text, text, jsonb);

-- p_submission_id defaults to null so legacy callers (and pre-DEC-039 pgTAP
-- fixtures) remain valid; the app always passes one.
create function public.place_order(
  p_customer_id          uuid,
  p_week_of              date,
  p_fulfillment_type     text,
  p_delivery_address     text,
  p_delivery_preference  text,
  p_pickup_note          text,
  p_notes                text,
  p_items                jsonb,
  p_submission_id        uuid default null
)
returns table(order_id uuid, appended boolean)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order_id     uuid;
  v_status       text;
  v_appended     boolean := false;
  v_item         jsonb;
  v_product_id   uuid;
  v_unit_id      uuid;
  v_qty          int;
  v_unit_price   int;
  v_conv         numeric(10,4);
  v_negative     boolean;
begin
  -- NOTE: `order_id` and `appended` are in scope as OUT variables of the
  -- RETURNS TABLE clause — every column reference below is table-qualified
  -- to avoid ambiguity.

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'place_order: p_items must be a non-empty json array';
  end if;

  -- Replay short-circuit (idempotency). If any order_items row already
  -- carries this submission_id, the submission was applied — return the
  -- order it landed on without inserting or decrementing anything. This
  -- replaces the old ON CONFLICT no-op for the double-tap / retried-POST
  -- case (which under DEC-039 would otherwise APPEND a duplicate).
  if p_submission_id is not null then
    -- Scoped to this customer's week: submission_id is a client-supplied UUID
    -- with no unique constraint, so a replayed FOREIGN submission_id must not
    -- resolve to someone else's order. A collision/forge finds nothing here
    -- and falls through to create/append under the caller's own identity.
    select oi.order_id into v_order_id
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where oi.submission_id = p_submission_id
       and o.customer_id = p_customer_id
       and o.week_of = p_week_of
     limit 1;
    if v_order_id is not null then
      -- Report `appended` consistently with the original call: the
      -- submission was an append iff the order carries items from other
      -- submissions (or pre-DEC-039 null-submission rows).
      return query
        select v_order_id,
               exists (
                 select 1 from public.order_items oi
                  where oi.order_id = v_order_id
                    and oi.submission_id is distinct from p_submission_id
               );
      return;
    end if;
  end if;

  -- Resolve the week's order. The unique (customer_id, week_of) insert is
  -- still the race-free arbiter of "who creates the row"; losing the race
  -- (or appending later) falls through to a locked read of the existing row.
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
    v_appended := true;
    -- Lock the existing order row for this transaction so a concurrent
    -- append/status change serializes behind us.
    select o.id, o.status into v_order_id, v_status
      from public.orders o
     where o.customer_id = p_customer_id and o.week_of = p_week_of
       for update;

    -- In-lock replay re-check — closes the create-vs-append race on a shared
    -- submission_id. The outside-the-lock replay check above is not enough: two
    -- concurrent requests with the same submission_id can both pass it (neither
    -- has committed items yet), one wins the on-conflict insert and the other
    -- arrives here. A unique index on submission_id can't arbitrate (one
    -- submission legitimately inserts many items sharing the id), so we lock the
    -- order row, then re-check: the winner's items are now committed and visible
    -- (READ COMMITTED), so we short-circuit instead of decrementing twice.
    if p_submission_id is not null and exists (
      select 1 from public.order_items oi
       where oi.order_id = v_order_id
         and oi.submission_id = p_submission_id
    ) then
      return query
        select v_order_id,
               exists (
                 select 1 from public.order_items oi
                  where oi.order_id = v_order_id
                    and oi.submission_id is distinct from p_submission_id
               );
      return;
    end if;

    -- Terminal guard: the box has already been handed over — appending is
    -- refused, nothing is written. The app writes hyphenated statuses
    -- (orders-queries.ts isTerminalStatus); keep this list identical to it.
    if v_status in ('picked-up', 'delivered') then
      raise exception 'place_order: order already fulfilled'
        using errcode = 'P0001';
    end if;

    -- Notes on an append are additive — never clobber what the customer
    -- already told Annabel.
    if coalesce(trim(p_notes), '') <> '' then
      update public.orders o
         set notes = case
                       when coalesce(trim(o.notes), '') = '' then p_notes
                       else o.notes || ' — ' || p_notes
                     end,
             updated_at = now()
       where o.id = v_order_id;
    end if;
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
      select pu.id into v_unit_id
        from public.product_units pu
       where pu.product_id = v_product_id and pu.is_active = true
       order by pu.sort_order nulls last, pu.created_at
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
    select pu.unit_price_cents, pu.conversion_to_base
      into v_unit_price, v_conv
      from public.product_units pu
     where pu.id = v_unit_id and pu.product_id = v_product_id;

    if v_unit_price is null then
      raise exception
        'place_order: product_unit_id % does not belong to product %', v_unit_id, v_product_id;
    end if;

    insert into public.order_items (order_id, product_id, product_unit_id, qty, unit_price_cents, submission_id)
    values (v_order_id, v_product_id, v_unit_id, v_qty, v_unit_price, p_submission_id);

    -- DEC-036: optimistic oversell (DEC-012) applies only while there is
    -- stock to draw down. The `qty_available > 0` guard makes this a no-op
    -- on a sold-out product; FOUND is then false and we reject the whole
    -- order. qty_available > 0 but insufficient still decrements into the
    -- negative + flags reconciliation below — unchanged "last few" behavior.
    update public.products p
       set qty_available = p.qty_available - (v_qty::numeric * v_conv),
           updated_at = now()
     where p.id = v_product_id and p.qty_available > 0;

    if not found then
      raise exception 'place_order: product % is sold out', v_product_id
        using errcode = 'P0001';
    end if;
  end loop;

  -- An append re-enters Annabel's pipeline: a confirmed/ready order goes
  -- back to 'new' (the stale confirmation SMS is covered by Re-send). A
  -- 'new' order is untouched; terminal was refused above.
  if v_appended then
    update public.orders o
       set status = 'new',
           updated_at = now()
     where o.id = v_order_id
       and o.status in ('confirmed', 'ready');
  end if;

  -- Flip needs_reconciliation if any product touched by this order is now
  -- negative. The join runs over ALL the order's items (original +
  -- appended), so an append re-evaluates the whole order.
  select exists (
    select 1
    from public.products p
    join public.order_items oi on oi.product_id = p.id
    where oi.order_id = v_order_id
      and p.qty_available < 0
  ) into v_negative;

  if v_negative then
    update public.orders o
       set needs_reconciliation = true
     where o.id = v_order_id;
  end if;

  return query select v_order_id, v_appended;
end;
$$;

-- Re-apply access control for the new signature (function privileges don't
-- carry across a drop/create).
revoke all on function public.place_order(uuid, date, text, text, text, text, text, jsonb, uuid) from public;
grant execute on function public.place_order(uuid, date, text, text, text, text, text, jsonb, uuid) to service_role;
