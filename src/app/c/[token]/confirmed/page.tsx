import Link from "next/link";
import { PausedShell } from "@/components/customer/PausedShell";
import { StatusShell } from "@/components/customer/StatusShell";
import { isTerminalStatus } from "@/lib/admin/orders-queries";
import {
  anyOrderable,
  getAvailableProducts,
  getLatestOrder,
  getOrderingScheduleStatus,
} from "@/lib/customer/queries";
import { lookupCustomerByToken } from "@/lib/customer/session";
import { weekOfLabel } from "@/lib/week";

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

function shortRef(orderId: string): string {
  // Take the leading segment of the uuid — stable, short enough to read aloud
  // without revealing anything sensitive.
  return orderId.slice(0, 8).toUpperCase();
}

export default async function ConfirmedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const customer = await lookupCustomerByToken(token);

  if (!customer) {
    return (
      <StatusShell>
        <h1 className="status-title">This link isn&rsquo;t active.</h1>
        <p className="status-lede">
          Text Annabel for a new ordering link · 216-202-5718.
        </p>
      </StatusShell>
    );
  }

  // #130 — same gate as /c/[token]. A closed/paused customer revisiting
  // /confirmed shouldn't see their prior order or any contact details
  // beyond their own name (already on the SMS that got them here).
  const greetingName = customer.business_name ?? customer.name;
  if (!customer.is_active) {
    return <PausedShell customerName={greetingName} reason="closed" />;
  }
  if (!customer.send_weekly_link) {
    return <PausedShell customerName={greetingName} reason="paused" />;
  }

  // DEC-041/DEC-042 (#227): the receipt is the customer's most recent order
  // in any status. Open → editable via "Add to your order"; terminal
  // (picked_up/delivered) → read-only, with a "place a new order" path (the
  // fulfilled order dropped out of the open-order identity, so a fresh one
  // is allowed).
  const order = await getLatestOrder(customer.id);

  if (!order) {
    // Cold-navigation case: someone hit /confirmed without ever ordering.
    return (
      <StatusShell>
        <h1 className="status-title">No order on file.</h1>
        <p className="status-lede">
          Place an order to get started.
        </p>
        <div className="status-actions">
          <Link href={`/c/${token}`} className="btn btn-primary status-btn">
            Open this week&rsquo;s list
          </Link>
        </div>
      </StatusShell>
    );
  }

  const items = order.order_items ?? [];
  const total = items.reduce(
    (sum, item) => sum + item.qty * item.unit_price_cents,
    0,
  );
  const greeting = customer.business_name ?? customer.name;

  // #211 / DEC-039 — "Add to your order" entry point. Gated on the same
  // predicates /c/[token] uses to render the form at all: ordering open
  // (DEC-031 soft hint), at least one orderable product (anyOrderable —
  // shared helper), and the order not terminal. A terminal order instead
  // offers "Place a new order" — under DEC-041 the fulfilled order freed
  // the identity, and /c/[token] will render a fresh form.
  const [schedule, products] = await Promise.all([
    getOrderingScheduleStatus(),
    getAvailableProducts(),
  ]);
  const terminal = isTerminalStatus(order.status);
  const canAdd = !terminal && schedule.is_open && anyOrderable(products);

  return (
    <StatusShell>
      <div className="status-art is-mark" aria-hidden="true">
        <svg viewBox="0 0 80 80" width="76" height="76">
          <circle cx="40" cy="40" r="38" fill="#EDF5E5" stroke="#3B6D11" strokeOpacity="0.3" strokeWidth="1" />
          <path d="M40 56 Q40 42 32 36 Q26 32 26 28 Q34 28 38 32 Q40 26 40 22 Q42 26 44 32 Q48 28 56 28 Q56 32 50 36 Q42 42 42 56 Z" fill="#4F8A1B" />
          <path d="M40 58 L40 50" stroke="#3B6D11" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      <div className="status-eyebrow eyebrow">
        order received · #{shortRef(order.id)}
      </div>
      <h1 className="status-title">Order received, {greeting}.</h1>
      <p className="status-lede">
        Thanks. Annabel will text you Wednesday morning with delivery details.
      </p>

      <div className="confirm-card">
        <div className="confirm-card-head">
          <div className="eyebrow">summary</div>
          {/* Stamped from the ORDER's week — under DEC-041 the latest order
              can be last week's, and today's clock would mislabel it. */}
          <span className="confirm-week">
            {weekOfLabel(new Date(order.week_of)).toLowerCase()}
          </span>
        </div>
        <ul className="confirm-list">
          {items.map((item) => {
            const product = item.products;
            const name = product?.name ?? "(item)";
            // 6.5f/DEC-037: the per-line unit label comes from product_units
            // (what the customer actually selected) — the sole source now
            // that products.unit is dropped. A missed join renders unitless.
            const unit = item.product_units?.label ?? "";
            return (
              <li key={item.id}>
                <span className="confirm-line-name">
                  <span className="confirm-qty">{item.qty}×</span>
                  <span>{name}</span>
                  {unit ? <span className="confirm-unit"> · {unit}</span> : null}
                </span>
                <span className="confirm-amt">
                  ${formatPrice(item.qty * item.unit_price_cents)}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="confirm-total">
          <span>Total</span>
          <span className="mono">${formatPrice(total)}</span>
        </div>
      </div>

      <div className="confirm-fulfill">
        <div className="confirm-fulfill-row">
          <div className="confirm-fulfill-key">
            {order.fulfillment_type === "pickup" ? "Pickup" : "Delivery"}
          </div>
          <div>
            {order.fulfillment_type === "pickup" ? (
              <>
                <div className="confirm-fulfill-val">
                  {order.pickup_note?.trim() || "Pickup at the farm"}
                </div>
                <div className="confirm-fulfill-sub">3612 W 114th St, Cleveland</div>
              </>
            ) : (
              <>
                <div className="confirm-fulfill-val">
                  {order.delivery_preference?.trim() ||
                    "Wednesday morning, 8am–noon"}
                </div>
                {order.delivery_address ? (
                  <div className="confirm-fulfill-sub">
                    {order.delivery_address}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {order.notes?.trim() ? (
        <div className="callout callout-info status-callout">
          <div>
            <strong>Your note to Annabel</strong>
            <div style={{ marginTop: 4, color: "var(--ink-700)" }}>
              {order.notes.trim()}
            </div>
          </div>
        </div>
      ) : null}

      <div className="callout callout-info status-callout">
        <div>
          <strong>An invoice will follow from Annabel via Wave.</strong>
          <div style={{ marginTop: 4, color: "var(--ink-700)" }}>
            Pay at delivery — cash, check, Venmo, or PayPal.
          </div>
        </div>
      </div>

      <div className="status-actions">
        {canAdd ? (
          <Link
            href={`/c/${token}`}
            className="btn btn-primary status-btn"
          >
            Add to your order
          </Link>
        ) : terminal ? (
          <>
            <p className="status-fine">
              This order&rsquo;s been packed — it&rsquo;s on its way.
            </p>
            {schedule.is_open && anyOrderable(products) ? (
              <Link
                href={`/c/${token}`}
                className="btn btn-primary status-btn"
              >
                Place a new order
              </Link>
            ) : null}
          </>
        ) : !schedule.is_open ? (
          <p className="status-fine">
            Ordering&rsquo;s closed for this week.
          </p>
        ) : null}
        {/* anyOrderable=false (everything sold out) shows no add affordance
            and no reason line — nothing left to add is self-explanatory. */}
        <a href="sms:2162025718" className="btn btn-secondary status-btn">
          Need a change? Text Annabel · 216-202-5718
        </a>
      </div>
    </StatusShell>
  );
}
