-- 0001_init.sql — clean baseline (DEC-046). Replaces the 27 Supabase
-- migrations as the source of truth for a fresh database. Authored from a
-- schema-only dump of the final Supabase state, minus what DEC-048 deletes:
-- every RLS policy, public.users + its auth.users FK (Supabase-auth mirror),
-- and the auth.users FK on customer_sends.sent_by_user_id (column kept as a
-- bare uuid; its repoint-or-drop lands with the admins table in 10.3/10.4).
-- The service layer is the access boundary — this schema carries no policies.

-- ── Functions ────────────────────────────────────────────────────────────────

-- BEFORE-INSERT default: fill product_unit_id with the product's first active
-- unit when the payload omits it (6.5a).
CREATE FUNCTION public.order_items_default_unit() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  if new.product_unit_id is null then
    select id into new.product_unit_id
      from public.product_units
     where product_id = new.product_id and is_active = true
     order by sort_order nulls last, created_at
     limit 1;
  end if;
  return new;
end;
$$;

-- place_order — additive open-order submit (DEC-039/041). Ported unchanged
-- from Supabase; pure Postgres. See supabase/tests/place_order_additive.sql
-- for the concurrency contract.
CREATE FUNCTION public.place_order(p_customer_id uuid, p_week_of date, p_fulfillment_type text, p_delivery_address text, p_delivery_preference text, p_pickup_note text, p_notes text, p_items jsonb, p_submission_id uuid DEFAULT NULL::uuid) RETURNS TABLE(order_id uuid, appended boolean)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
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

-- set_base_unit — rebase a product's unit conversions (6.5c/DEC-032).
CREATE FUNCTION public.set_base_unit(p_product_id uuid, p_new_base_unit_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
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

  -- Guard the conversion_to_base > 0 CHECK: a large rescale factor (a tiny
  -- unit promoted onto a much bigger base) can round a small conversion down
  -- to 0.0000 and abort the whole rebase with a raw constraint error. Catch
  -- it up front with a remedy-shaped message instead.
  if exists (
    select 1 from public.product_units
     where product_id = p_product_id
       and round(conversion_to_base / v_old_conv, 4) <= 0
  ) then
    raise exception
      'set_base_unit: units on product % are too far apart in scale to switch the base unit (a conversion would round to zero)',
      p_product_id;
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

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE public.codes (
    type text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    sort_order integer,
    CONSTRAINT codes_pkey PRIMARY KEY (type, code)
);

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    business_name text,
    phone text,
    email text,
    token text NOT NULL,
    delivery_address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    send_weekly_link boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    CONSTRAINT customers_pkey PRIMARY KEY (id),
    CONSTRAINT customers_token_key UNIQUE (token),
    CONSTRAINT customers_priority_check CHECK ((priority >= 0))
);

COMMENT ON COLUMN public.customers.priority IS 'Send-queue ordering (DEC-026/027). Lower = earlier in the cycle. Default 100.';

CREATE TABLE public.customer_sends (
    customer_id uuid NOT NULL,
    week_of date NOT NULL,
    mode text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_by_user_id uuid,
    CONSTRAINT customer_sends_pkey PRIMARY KEY (customer_id, week_of, mode),
    CONSTRAINT customer_sends_mode_check CHECK ((mode = ANY (ARRAY['weekly_update'::text, 'order_confirmation'::text, 'pickup_reminder'::text, 'delivery_reminder'::text]))),
    CONSTRAINT customer_sends_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE
);

COMMENT ON COLUMN public.customer_sends.sent_by_user_id IS 'Legacy Supabase-auth attribution (was FK → auth.users). Bare uuid on Neon; repoint to admins or drop in 10.3/10.4 (DEC-048).';

CREATE TABLE public.fulfillment_link (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    is_singleton boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fulfillment_link_pkey PRIMARY KEY (id),
    CONSTRAINT fulfillment_link_token_key UNIQUE (token),
    CONSTRAINT fulfillment_link_is_singleton_key UNIQUE (is_singleton),
    CONSTRAINT fulfillment_link_singleton CHECK (is_singleton)
);

COMMENT ON TABLE public.fulfillment_link IS 'Singleton holding the secret token for the public /f/[token] harvest & pack sheet. The service layer resolves the token (DEC-048).';

CREATE TABLE public.ordering_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    is_singleton boolean DEFAULT true NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    weekly_open_day smallint,
    weekly_open_time time without time zone,
    weekly_close_day smallint,
    weekly_close_time time without time zone,
    override_closes_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    intro_note text,
    CONSTRAINT ordering_schedule_pkey PRIMARY KEY (id),
    CONSTRAINT ordering_schedule_is_singleton_key UNIQUE (is_singleton),
    CONSTRAINT ordering_schedule_is_singleton_check CHECK ((is_singleton = true)),
    CONSTRAINT ordering_schedule_weekly_close_day_check CHECK (((weekly_close_day >= 0) AND (weekly_close_day <= 6))),
    CONSTRAINT ordering_schedule_weekly_open_day_check CHECK (((weekly_open_day >= 0) AND (weekly_open_day <= 6)))
);

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    qty_available numeric(10,2) DEFAULT 0 NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    sort_order integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category text DEFAULT 'Other'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT products_pkey PRIMARY KEY (id),
    CONSTRAINT products_category_check CHECK ((category = ANY (ARRAY['Vegetables'::text, 'Fruit'::text, 'Herbs'::text, 'Flowers'::text, 'Other'::text])))
);

COMMENT ON COLUMN public.products.is_active IS 'Soft-delete flag. false = hidden/archived: excluded from the customer order form and the default admin inventory view, but order_items references remain valid. Distinct from is_available (per-week sold-out toggle).';

CREATE TABLE public.product_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    label text NOT NULL,
    conversion_to_base numeric(10,4) DEFAULT 1.0 NOT NULL,
    unit_price_cents integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    slug text NOT NULL,
    sort_order integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sku text,
    CONSTRAINT product_units_pkey PRIMARY KEY (id),
    CONSTRAINT product_units_product_id_label_key UNIQUE (product_id, label),
    CONSTRAINT product_units_slug_key UNIQUE (slug),
    CONSTRAINT product_units_conversion_to_base_check CHECK ((conversion_to_base > (0)::numeric)),
    CONSTRAINT product_units_unit_price_cents_check CHECK ((unit_price_cents > 0)),
    CONSTRAINT product_units_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);

COMMENT ON COLUMN public.product_units.sku IS 'DEC-043: Wave "Item Number" for this unit''s export lines. Editable so it can match the existing Wave item catalog. Null falls back to slug in the export.';

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    week_of date NOT NULL,
    fulfillment_type text DEFAULT 'delivery'::text NOT NULL,
    delivery_address text,
    status text DEFAULT 'new'::text NOT NULL,
    needs_reconciliation boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pickup_note text,
    delivery_preference text,
    CONSTRAINT orders_pkey PRIMARY KEY (id),
    CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT
);

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty integer NOT NULL,
    unit_price_cents integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    product_unit_id uuid NOT NULL,
    submission_id uuid,
    CONSTRAINT order_items_pkey PRIMARY KEY (id),
    CONSTRAINT order_items_qty_check CHECK ((qty > 0)),
    CONSTRAINT order_items_unit_price_cents_check CHECK ((unit_price_cents > 0)),
    CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
    CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT,
    CONSTRAINT order_items_product_unit_id_fkey FOREIGN KEY (product_unit_id) REFERENCES public.product_units(id) ON DELETE RESTRICT
);

COMMENT ON COLUMN public.order_items.submission_id IS 'Client-generated per-submit-attempt UUID (DEC-039). Idempotency key for place_order — a replayed submission is a no-op returning the existing order — and per-submission audit (which submit attempt created this line). Null on rows that predate additive orders.';

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX customer_sends_week_mode_idx ON public.customer_sends USING btree (week_of, mode);
CREATE INDEX customers_token_idx ON public.customers USING btree (token);
CREATE INDEX order_items_order_id_idx ON public.order_items USING btree (order_id);
CREATE INDEX order_items_product_id_idx ON public.order_items USING btree (product_id);
CREATE INDEX order_items_product_unit_id_idx ON public.order_items USING btree (product_unit_id);
CREATE INDEX order_items_submission_id_idx ON public.order_items USING btree (submission_id);
CREATE INDEX orders_customer_id_idx ON public.orders USING btree (customer_id);
CREATE INDEX orders_needs_reconciliation_idx ON public.orders USING btree (needs_reconciliation) WHERE (needs_reconciliation = true);
CREATE INDEX orders_week_of_idx ON public.orders USING btree (week_of);
CREATE INDEX product_units_active_idx ON public.product_units USING btree (product_id) WHERE is_active;
CREATE INDEX product_units_product_id_idx ON public.product_units USING btree (product_id);

-- DEC-041: at most one non-terminal order per customer. Terminal statuses
-- (picked_up/delivered) fall outside the predicate and free a new order.
-- place_order's ON CONFLICT infers this index — it is load-bearing.
CREATE UNIQUE INDEX orders_one_open_per_customer ON public.orders USING btree (customer_id) WHERE (status = ANY (ARRAY['new'::text, 'confirmed'::text, 'ready'::text]));

COMMENT ON INDEX public.orders_one_open_per_customer IS 'DEC-041: at most one non-terminal order per customer. Terminal statuses (picked_up/delivered) fall outside the predicate and free a new order.';

-- ── Triggers ─────────────────────────────────────────────────────────────────

CREATE TRIGGER order_items_default_unit_trigger BEFORE INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.order_items_default_unit();

-- ── Seed data ────────────────────────────────────────────────────────────────

INSERT INTO public.codes (type, code, label, sort_order) VALUES
  ('fulfillment_type', 'delivery', 'Delivery', 1),
  ('fulfillment_type', 'pickup', 'Pickup', 2),
  ('order_status', 'new', 'New', 1),
  ('order_status', 'confirmed', 'Confirmed', 2),
  ('order_status', 'ready', 'Ready', 3),
  ('order_status', 'picked_up', 'Picked Up', 4),
  ('order_status', 'delivered', 'Delivered', 5);

-- Singletons. Ordering starts closed (matches original migration); the
-- fulfillment link token mints fresh per database via the column default.
INSERT INTO public.ordering_schedule (is_open) VALUES (false);
INSERT INTO public.fulfillment_link (is_singleton) VALUES (true);
