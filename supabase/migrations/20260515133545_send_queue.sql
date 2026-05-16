-- Phase 4.2 — Send-queue persistence.
-- Per DEC-026, Bushel does not send SMS itself; the admin send-queue surfaces
-- `sms:` deep links per customer. This migration adds:
--   1. customer_sends — one row per (customer, week, mode); presence = "marked sent"
--   2. ordering_schedule.intro_note — per-cycle operator-edited intro injected
--      into the weekly_update template body

-- ------------------------------------------------------------
-- ordering_schedule.intro_note (per-cycle operator note)
-- ------------------------------------------------------------
alter table public.ordering_schedule
  add column intro_note text;

-- ------------------------------------------------------------
-- customer_sends — operator-marked send state, per cycle, per mode
-- ------------------------------------------------------------
create table public.customer_sends (
  customer_id      uuid         not null references public.customers(id) on delete cascade,
  week_of          date         not null,
  mode             text         not null check (mode in ('weekly_update','order_confirmation','pickup_reminder')),
  sent_at          timestamptz  not null default now(),
  sent_by_user_id  uuid         references auth.users(id) on delete set null,
  primary key (customer_id, week_of, mode)
);

create index customer_sends_week_mode_idx
  on public.customer_sends (week_of, mode);

alter table public.customer_sends enable row level security;

-- Admin-only — no anon access (no token-scoped read either; this is admin state).
create policy "admin_all_customer_sends" on public.customer_sends
  for all to authenticated using (true) with check (true);
