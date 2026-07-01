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

// #241: DEC-039 appends insert one order_items row per submission, so the
// same product+unit can appear N times on one order. The rows stay granular
// in the DB (submission_id is the idempotency key + audit trail) — but
// nobody READING an order cares which submission a line arrived in, so
// every display surface groups through here: same key → one line, qty
// summed. The first row of a group supplies the rest of the fields (React
// keys, names, prices — identical within a group by construction).
//
// The key is (product, unit label, unit price) — build it with
// consolidationKey so every surface groups identically. Unit label is a
// faithful proxy for product_unit_id (product_units has unique
// (product_id, label) and order_items.product_unit_id is on-delete-restrict,
// so the label join can't be null or ambiguous within a product). Price
// belongs in the key: a price change between a customer's first order and
// their top-up is an invoicing truth that must stay its own line, not noise
// to merge away.
export function consolidationKey(
  productId: string,
  unitLabel: string,
  unitPriceCents: number,
): string {
  return `${productId}|${unitLabel}|${unitPriceCents}`;
}

export function consolidateItems<T extends { qty: number }>(
  items: ReadonlyArray<T>,
  keyOf: (item: T) => string,
): T[] {
  const grouped = new Map<string, T>();
  for (const it of items) {
    const key = keyOf(it);
    const prev = grouped.get(key);
    grouped.set(
      key,
      prev ? { ...prev, qty: Math.round((prev.qty + it.qty) * 100) / 100 } : it,
    );
  }
  return [...grouped.values()];
}
