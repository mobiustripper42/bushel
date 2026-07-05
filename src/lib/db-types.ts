// Plain row types for the pg data layer (DEC-046). These replace the
// generated supabase Database["public"]["Tables"][...]["Row"] types —
// hand-maintained against db/migrations/0001_init.sql (+ later migrations).
// Timestamps arrive as ISO strings, dates as 'YYYY-MM-DD', numerics as
// numbers (see the type parsers in src/lib/db.ts).

export type CustomerRow = {
  id: string;
  name: string;
  business_name: string | null;
  phone: string | null;
  email: string | null;
  token: string;
  delivery_address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  send_weekly_link: boolean;
  priority: number;
};

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  qty_available: number;
  is_available: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  category: string;
  is_active: boolean;
};

export type ProductUnitRow = {
  id: string;
  product_id: string;
  label: string;
  conversion_to_base: number;
  unit_price_cents: number;
  is_active: boolean;
  slug: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  sku: string | null;
};

export type OrderingScheduleRow = {
  id: string;
  is_singleton: boolean;
  is_open: boolean;
  weekly_open_day: number | null;
  weekly_open_time: string | null;
  weekly_close_day: number | null;
  weekly_close_time: string | null;
  override_closes_at: string | null;
  created_at: string;
  updated_at: string;
  intro_note: string | null;
};
