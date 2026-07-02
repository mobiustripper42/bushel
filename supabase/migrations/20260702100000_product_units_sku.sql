-- #228 / DEC-043 — per-unit editable SKU.
--
-- Wave's "Item Number" is a PER-UNIT truth under multi-unit (one product →
-- multiple orderable units, each its own Wave line item), and it must match
-- Annabel's existing Wave item catalog — so it's editable, not the generated
-- slug. The export resolves sku → slug → blank; products.description leaves
-- the export entirely and reverts to its sole purpose, the customer-facing
-- long description.
--
-- Nullable, no backfill: Annabel fills SKUs in as she reconciles her Wave
-- catalog; slug keeps exports working meanwhile.

alter table public.product_units
  add column sku text;

comment on column public.product_units.sku is
  'DEC-043: Wave "Item Number" for this unit''s export lines. Editable so it '
  'can match the existing Wave item catalog. Null falls back to slug in the '
  'export.';
