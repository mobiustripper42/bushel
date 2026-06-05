-- Delivery reminder send mode (#193 — amends DEC-014).
--
-- DEC-014 originally said "no delivery reminders (B2B locations are staffed)".
-- Annabel wants parity with pickup reminders, sent per-order from the Orders
-- page. Widen the customer_sends.mode CHECK to accept 'delivery_reminder'.
-- Kept distinct from pickup_reminder so per-mode sent-state stays unambiguous.

alter table public.customer_sends
  drop constraint customer_sends_mode_check;

alter table public.customer_sends
  add constraint customer_sends_mode_check
  check (mode in ('weekly_update', 'order_confirmation', 'pickup_reminder', 'delivery_reminder'));
