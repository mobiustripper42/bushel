// Total items in an order = sum of qty across every line. The "items"
// label is shown verbatim on the customer form, admin orders list, and
// the Telegram order-arrival alert — every place uses this so the number
// matches everywhere (issue #159).
//
// `qty` is `numeric(10,2)` in Postgres and arrives as a string on some
// joined Supabase shapes; `Number(...)` normalises that. `|| 0` guards
// against a non-numeric escape (corrupt row, future caller bypassing
// types) so we never render literal "NaN items" to Annabel or the
// customer. Fractional values are rounded to 2dp to avoid the classic
// float-precision render (1.1 + 2.2 → "3.3000000000000003 items").
export function totalItemCount(items: ReadonlyArray<{ qty: number | string }>): number {
  let sum = 0;
  for (const it of items) sum += Number(it.qty) || 0;
  return Math.round(sum * 100) / 100;
}
