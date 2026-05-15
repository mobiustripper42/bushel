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
  // Bushel's order cadence opens Sun/Mon → fulfills Wed/Thu. Sunday is the
  // OPENING of the new order week, so it maps to *tomorrow's* Monday
  // (offset = -1, i.e. add a day). Mon–Sat roll back to this week's Monday.
  // Don't change this without considering the unique (customer_id, week_of)
  // constraint — a misaligned Sunday silently buckets an order into last
  // week, and the second-submit guard in place_order() will redirect the
  // customer to last week's /confirmed without ever inserting their new order.
  const offset = dayIdx === 0 ? -1 : dayIdx - 1;

  const anchor = new Date(Date.UTC(y, m - 1, d));
  anchor.setUTCDate(anchor.getUTCDate() - offset);
  return anchor.toISOString().slice(0, 10);
}

// Shell chrome strings, Sunday-anchored, NY-time. Same tz discipline as
// weekOfMondayNY — late-Saturday-NY (Sunday UTC) would otherwise jump the
// admin shell into next week several hours early.
//
// Returns:
//   topbar: "Sun, May 3"          (for the top-bar "Week of" pill)
//   range:  "May 3 – May 9"        (for the sidebar "This week" row)
export function shellWeekStringsNY(now: Date = new Date()): {
  topbar: string;
  range: string;
} {
  // Monday of the current NY week (YYYY-MM-DD), then back up one day to Sunday.
  const monday = weekOfMondayNY(now);
  const [y, m, d] = monday.split("-").map((n) => parseInt(n, 10));
  const sunday = new Date(Date.UTC(y, m - 1, d));
  sunday.setUTCDate(sunday.getUTCDate() - 1);
  const saturday = new Date(sunday);
  saturday.setUTCDate(saturday.getUTCDate() + 6);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const topbar = `${days[sunday.getUTCDay()]}, ${MONTHS[sunday.getUTCMonth()]} ${sunday.getUTCDate()}`;

  const sameMonth = sunday.getUTCMonth() === saturday.getUTCMonth();
  const range = sameMonth
    ? `${MONTHS[sunday.getUTCMonth()]} ${sunday.getUTCDate()} – ${saturday.getUTCDate()}`
    : `${MONTHS[sunday.getUTCMonth()]} ${sunday.getUTCDate()} – ${MONTHS[saturday.getUTCMonth()]} ${saturday.getUTCDate()}`;

  return { topbar, range };
}
