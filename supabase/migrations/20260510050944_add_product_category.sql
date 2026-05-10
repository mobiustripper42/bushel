-- Phase 2.0a: add category to products to match the inventory editor UX.
-- Values mirror the design mockup: Vegetables, Fruit, Herbs, Flowers, Other.

alter table public.products
  add column category text not null default 'Other'
    check (category in ('Vegetables', 'Fruit', 'Herbs', 'Flowers', 'Other'));
