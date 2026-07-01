-- #226 / DEC-041 — order identity is the open order, not the week.
--
-- A customer has at most one NON-TERMINAL order ('new'/'confirmed'/'ready');
-- fulfilled orders ('picked_up'/'delivered', DEC-044 snake_case) drop out and
-- free a new one. week_of is demoted to an informational stamp — still set at
-- insert, still feeds the fulfillment sheet + Wave export, no longer identity.
--
-- Hard cutover (DEC-041): orders / order_items / customer_sends are wiped —
-- no history, no backfill. The truncate runs HERE, inside the migration, so
-- the identity swap below can never trip over pre-pivot data (a customer with
-- two same-week orders, or hyphen-status rows from before DEC-044). products /
-- product_units / customers are untouched.
--
-- The old unique (customer_id, week_of) is dropped IN this migration, not
-- deferred — it forbids the very second-same-week order the new partial index
-- exists to allow, so the two cannot coexist through live traffic.
--
-- place_order re-key (#218's 9-arg fn, signature unchanged): week_of was
-- load-bearing in four spots —
--   1. ON CONFLICT arbiter        → infers the partial index (predicate
--                                   restated verbatim; the inserted row's
--                                   status='new' satisfies it). The
--                                   concurrency linchpin.
--   2. FOR UPDATE existing lock   → keyed to open status, not the week.
--   3. Outside-lock replay join   → keyed to customer only. A replayed
--                                   submission_id short-circuits to whatever
--                                   order it landed on — even one that has
--                                   since gone terminal (replay means
--                                   "already applied", not "apply again").
--   4. In-lock replay re-check    → keyed on order_id, unchanged.
--
-- The old terminal guard ('order already fulfilled') is GONE, structurally:
-- the lock predicate only ever finds an open order, so a terminal order can
-- never receive an append. A submission arriving when the customer's last
-- order is terminal simply creates a fresh open order — that is the point of
-- DEC-041 ("fulfilled orders drop out, freeing a new one").
--
-- Insert-vs-lock race: between the conflicting INSERT and the FOR UPDATE
-- lock, the open order can go terminal (Annabel marks it picked_up). READ
-- COMMITTED's EvalPlanQual then excludes the row from the locked SELECT —
-- zero rows, nothing locked. The create-or-find LOOP retries the INSERT,
-- which now succeeds (no open row blocks the partial index). Each iteration
-- either creates or locks, so the loop terminates.

truncate table public.orders, public.order_items, public.customer_sends;

alter table public.orders
  drop constraint orders_customer_id_week_of_key;

create unique index orders_one_open_per_customer
  on public.orders (customer_id)
  where status in ('new', 'confirmed', 'ready');

comment on index public.orders_one_open_per_customer is
  'DEC-041: at most one non-terminal order per customer. Terminal statuses '
  '(picked_up/delivered) fall outside the predicate and free a new order.';

-- Same signature + return type as 20260612170000 → CREATE OR REPLACE keeps
-- the existing grants (service_role execute, revoked from public).
create or replace function public.place_order(
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
  -- order it landed on without inserting or decrementing anything.
  if p_submission_id is not null then
    -- Scoped to this customer: submission_id is a client-supplied UUID with
    -- no unique constraint, so a replayed FOREIGN submission_id must not
    -- resolve to someone else's order. A collision/forge finds nothing here
    -- and falls through to create/append under the caller's own identity.
    -- (DEC-041: week scope dropped — the customer scope alone is what keeps
    -- a replay from resolving to the wrong order after a new open order
    -- replaced a fulfilled one, because the replayed id's items still point
    -- at the order they originally landed on.)
    select oi.order_id into v_order_id
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where oi.submission_id = p_submission_id
       and o.customer_id = p_customer_id
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

  -- Resolve the customer's OPEN order — create-or-find loop (DEC-041).
  -- The partial-index-inferring insert is the race-free arbiter of "who
  -- creates the row"; losing the race falls through to a locked read of the
  -- open row. If that row goes terminal between the two statements
  -- (EvalPlanQual excludes it → zero rows), loop back and re-insert.
  loop
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
    on conflict (customer_id) where status in ('new', 'confirmed', 'ready')
    do nothing
    returning id into v_order_id;

    if v_order_id is not null then
      exit;  -- created the open order
    end if;

    -- Lock the existing open order for this transaction so a concurrent
    -- append/status change serializes behind us.
    select o.id, o.status into v_order_id, v_status
      from public.orders o
     where o.customer_id = p_customer_id
       and o.status in ('new', 'confirmed', 'ready')
       for update;

    if v_order_id is not null then
      v_appended := true;
      exit;  -- locked the open order — append path
    end if;
    -- Open order vanished (went terminal) between insert and lock; retry.
  end loop;

  if v_appended then
    -- In-lock replay re-check — closes the create-vs-append race on a shared
    -- submission_id. The outside-the-lock replay check above is not enough: two
    -- concurrent requests with the same submission_id can both pass it (neither
    -- has committed items yet), one wins the arbiter insert and the other
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
  -- 'new' order is untouched; a terminal order is unreachable here (the
  -- lock predicate only finds open orders).
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
