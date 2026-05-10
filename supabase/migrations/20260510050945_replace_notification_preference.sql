-- Phase 2.0a: replace notification_preference with send_weekly_link.
--
-- notification_preference ('sms'/'email'/'none') is vestigial from before
-- DEC-026 (operator-sent SMS deep links; no platform-sent email to customers).
-- In V1 all customer outbound is SMS-only, so the channel choice collapses to
-- a single boolean: does this customer receive the weekly order link?
--
-- Migration is safe on an empty table (dev/CI only at this stage).
-- Preserve intent: 'none' → false, anything else → true.

alter table public.customers
  add column send_weekly_link boolean not null default true;

update public.customers
  set send_weekly_link = (notification_preference <> 'none');

alter table public.customers
  drop column notification_preference;
