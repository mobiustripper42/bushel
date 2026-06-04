-- "Confirmed" order status (#190, DEC-035 — amends DEC-010).
--
-- Flow: new → [confirmed] → ready → (picked_up | delivered). Confirmed is
-- optional (Annabel may pack before texting, so new → ready stays valid).
-- orders.status remains app-enforced text (no FK/constraint); codes is the
-- lookup that drives ordinals + labels.

-- Insert the new status between New (1) and Ready, then renumber the rest.
insert into public.codes (type, code, label, sort_order) values
  ('order_status', 'confirmed', 'Confirmed', 2)
on conflict (type, code) do nothing;

update public.codes set sort_order = 3 where type = 'order_status' and code = 'ready';
update public.codes set sort_order = 4 where type = 'order_status' and code = 'picked_up';
update public.codes set sort_order = 5 where type = 'order_status' and code = 'delivered';
