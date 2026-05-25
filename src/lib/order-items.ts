// Total items in an order = sum of qty across every line. The "items"
// label is shown verbatim on the customer form, admin orders list, and
// the Telegram order-arrival alert — every place uses this so the number
// matches everywhere (issue #159).
//
// `qty` is `numeric(10,2)` in Postgres and arrives as a string on
// joined reads in some Supabase shapes; `Number(...)` normalises that.
// Fractional values are summed verbatim (1.5 lb basil + 2 lettuce = 3.5)
// — display layer formats however it likes.
export function totalItemCount(items: ReadonlyArray<{ qty: number | string }>): number {
  let sum = 0;
  for (const it of items) sum += Number(it.qty);
  return sum;
}
