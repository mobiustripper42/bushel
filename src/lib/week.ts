const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function weekOfLabel(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  return `Week of ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

// Returns the ISO date (YYYY-MM-DD) of Monday of the current week in
// America/New_York, regardless of where the server is running. Used as
// orders.week_of so all orders placed during the same NY-time week share
// a single date for the (customer_id, week_of) unique constraint.
//
// Strategy: take "now in NY" by formatting via Intl, parse back to
// y/m/d, then shift to Monday. Avoids pulling in a tz library.
export function weekOfMondayNY(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const y = parseInt(get("year"), 10);
  const m = parseInt(get("month"), 10);
  const d = parseInt(get("day"), 10);
  const weekday = get("weekday");

  // weekday: Sun, Mon, Tue, Wed, Thu, Fri, Sat
  const dayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  // ISO-style: Monday is the anchor. Sunday rolls back 6 days.
  const offset = dayIdx === 0 ? 6 : dayIdx - 1;

  const anchor = new Date(Date.UTC(y, m - 1, d));
  anchor.setUTCDate(anchor.getUTCDate() - offset);
  return anchor.toISOString().slice(0, 10);
}
