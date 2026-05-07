import { StatusShell } from "@/components/customer/StatusShell";

// TODO Phase 4: look up order by token + orderId and render real data
const PLACEHOLDER_ORDER = {
  ref: "0503-04",
  customer: "Maya",
  week: "week of may 3",
  items: [
    { name: "Heirloom tomatoes", qty: 4, unit: "lb", price: 5.5 },
    { name: "Dino kale", qty: 6, unit: "bunch", price: 4.5 },
    { name: "Red beets", qty: 2, unit: "lb", price: 3.25 },
    { name: "Genovese basil", qty: 3, unit: "bunch", price: 3.5 },
  ],
  delivery: {
    window: "Wed, May 6 · between 8am – noon",
    address: "16100 Detroit Ave, Lakewood",
  },
};

export default function ConfirmedPage() {
  const order = PLACEHOLDER_ORDER;
  const total = order.items.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <StatusShell>
      <div className="status-art is-mark" aria-hidden="true">
        <svg viewBox="0 0 80 80" width="76" height="76">
          <circle cx="40" cy="40" r="38" fill="#EDF5E5" stroke="#3B6D11" strokeOpacity="0.3" strokeWidth="1" />
          <path d="M40 56 Q40 42 32 36 Q26 32 26 28 Q34 28 38 32 Q40 26 40 22 Q42 26 44 32 Q48 28 56 28 Q56 32 50 36 Q42 42 42 56 Z" fill="#4F8A1B" />
          <path d="M40 58 L40 50" stroke="#3B6D11" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      <div className="status-eyebrow eyebrow">order received · #{order.ref}</div>
      <h1 className="status-title">Order received, {order.customer}.</h1>
      <p className="status-lede">
        Thanks. Annabel will text you Wednesday morning with delivery details.
      </p>

      <div className="confirm-card">
        <div className="confirm-card-head">
          <div className="eyebrow">summary</div>
          <span className="confirm-week">{order.week}</span>
        </div>
        <ul className="confirm-list">
          {order.items.map((item) => (
            <li key={item.name}>
              <span className="confirm-line-name">
                <span className="confirm-qty">{item.qty}×</span>
                <span>{item.name}</span>
                <span className="confirm-unit"> · {item.unit}</span>
              </span>
              <span className="confirm-amt">${(item.qty * item.price).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="confirm-total">
          <span>Total</span>
          <span className="mono">${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="confirm-fulfill">
        <div className="confirm-fulfill-row">
          <div className="confirm-fulfill-key">Delivery</div>
          <div>
            <div className="confirm-fulfill-val">{order.delivery.window}</div>
            <div className="confirm-fulfill-sub">{order.delivery.address}</div>
          </div>
        </div>
      </div>

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
