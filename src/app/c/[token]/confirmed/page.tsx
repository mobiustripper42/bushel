import Link from "next/link";
import { StatusShell } from "@/components/customer/StatusShell";
import { getCurrentWeekOrder } from "@/lib/customer/queries";
import { lookupCustomerByToken } from "@/lib/customer/session";
import { weekOfLabel, weekOfMondayNY } from "@/lib/week";

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

  const order = await getCurrentWeekOrder(customer.id, weekOfMondayNY());

  if (!order) {
    // Cold-navigation case: someone hit /confirmed without an order this week.
    return (
      <StatusShell>
        <h1 className="status-title">No order on file for this week.</h1>
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
          <span className="confirm-week">{weekOfLabel().toLowerCase()}</span>
        </div>
        <ul className="confirm-list">
          {items.map((item) => {
            const product = item.products;
            const name = product?.name ?? "(item)";
            const unit = product?.unit ?? "";
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
        <a href="sms:2162025718" className="btn btn-secondary status-btn">
          Need a change? Text Annabel · 216-202-5718
        </a>
      </div>
    </StatusShell>
  );
}
