-- #207 Hide/Show inventory items: soft-delete for products.
-- Mirrors customers.is_active (#61). Hidden products (is_active = false) are
-- dropped from the customer order form and the default admin inventory view,
-- but never hard-deleted — their order history stays intact.
alter table products add column is_active boolean not null default true;

comment on column products.is_active is
  'Soft-delete flag. false = hidden/archived: excluded from the customer order form and the default admin inventory view, but order_items references remain valid. Distinct from is_available (per-week sold-out toggle).';
