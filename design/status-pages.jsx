/* Customer status pages — closed, confirmed, invalid */

const { useState } = React;

function StatusShell({ children, tone }) {
  return (
    <div className={"status-page tone-" + (tone || "neutral")}>
      <div className="brand-strip">
        <div className="brand-mark">
          <span className="brand-leaf" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M21.5 2.5c0 8-4.5 14.5-12 14.5-1.4 0-2.8-.2-4-.7l1.4-1.4c.8.2 1.7.4 2.6.4 6 0 9.5-5.3 10-12.3-2 .6-7.4 2.6-10.4 7.4-1 1.6-1.5 3.4-1.7 5.4l-1.5 1.5c0-3.3.7-6.3 2.4-8.7C11.4 4 18.4 2.6 21.5 2.5z"/>
            </svg>
          </span>
          <span className="brand-name">Bay Branch Farm</span>
        </div>
      </div>
      <div className="status-shell">{children}</div>
      <footer className="status-foot">
        <div>Bay Branch Farm · 3612 W 114th St, Cleveland</div>
      </footer>
    </div>
  );
}

/* ── 1. Closed ────────────────────────────────────────── */
function ClosedPage() {
  return (
    <StatusShell tone="neutral">
      <div className="status-art">
        {/* "vegetables resting" — three vegetable forms tucked in a basket-shaped curve */}
        <svg viewBox="0 0 240 160" width="220" height="146" aria-hidden="true">
          {/* basket curve / ground */}
          <path d="M30 110 Q120 152 210 110" fill="none" stroke="#3B6D11" strokeOpacity="0.35" strokeWidth="1.5"/>
          <path d="M40 108 Q120 138 200 108" fill="#EDF5E5" stroke="#3B6D11" strokeOpacity="0.5" strokeWidth="1"/>
          {/* carrot, lying down */}
          <g transform="translate(60 92) rotate(-12)">
            <path d="M0 0 L48 4 L52 12 L4 14 Z" fill="#E6A817"/>
            <path d="M-6 -6 Q-3 -10 0 -8 M-2 -10 Q1 -14 4 -12 M2 -8 Q5 -14 9 -10" stroke="#3B6D11" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
          </g>
          {/* beet, round */}
          <g transform="translate(120 80)">
            <ellipse cx="0" cy="14" rx="18" ry="14" fill="#B23B2E" opacity="0.85"/>
            <path d="M-8 0 Q-6 -10 0 -12 M0 0 Q1 -12 6 -14 M6 0 Q10 -10 14 -8" stroke="#3B6D11" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
          </g>
          {/* lettuce ball */}
          <g transform="translate(170 90)">
            <circle r="16" fill="#4F8A1B" opacity="0.85"/>
            <circle r="11" fill="#5fa825" opacity="0.6"/>
            <path d="M-10 -6 Q-4 -12 4 -10 M-6 0 Q2 -8 10 -4" stroke="#FBFAF5" strokeOpacity="0.6" strokeWidth="1" fill="none"/>
          </g>
          {/* gentle z's overhead */}
          <text x="100" y="36" fontFamily="serif" fontStyle="italic" fontSize="22" fill="#3B6D11" opacity="0.55">z</text>
          <text x="118" y="26" fontFamily="serif" fontStyle="italic" fontSize="16" fill="#3B6D11" opacity="0.4">z</text>
          <text x="132" y="20" fontFamily="serif" fontStyle="italic" fontSize="12" fill="#3B6D11" opacity="0.3">z</text>
        </svg>
      </div>
      <div className="status-eyebrow eyebrow">this week · closed</div>
      <h1 className="status-title">Ordering's closed for this week.</h1>
      <p className="status-lede">
        We open again <strong>Sunday morning</strong>. You'll get a text from Annabel
        when this week's list is up.
      </p>
      <div className="status-meta">
        <div className="status-meta-row">
          <span className="status-meta-key">Last week's order</span>
          <span className="status-meta-val mono">$184.50 · delivered Wed</span>
        </div>
        <div className="status-meta-row">
          <span className="status-meta-key">Next opening</span>
          <span className="status-meta-val">Sun, May 11 · ~8am</span>
        </div>
      </div>
      <div className="status-actions">
        <a href="sms:2162025718" className="btn btn-secondary status-btn">
          Text Annabel · 216-202-5718
        </a>
      </div>
    </StatusShell>
  );
}

/* ── 2. Confirmed ───────────────────────────────────────── */
function ConfirmedPage() {
  const items = [
    { name: "Heirloom tomatoes", qty: 4, unit: "lb",     price: 5.50 },
    { name: "Dino kale",         qty: 6, unit: "bunch",  price: 4.50 },
    { name: "Red beets",         qty: 2, unit: "lb",     price: 3.25 },
    { name: "Genovese basil",    qty: 3, unit: "bunch",  price: 3.50 },
  ];
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <StatusShell tone="leaf">
      <div className="status-art is-mark">
        {/* Sprout / check */}
        <svg viewBox="0 0 80 80" width="76" height="76" aria-hidden="true">
          <circle cx="40" cy="40" r="38" fill="#EDF5E5" stroke="#3B6D11" strokeOpacity="0.3" strokeWidth="1"/>
          <path d="M40 56 Q40 42 32 36 Q26 32 26 28 Q34 28 38 32 Q40 26 40 22 Q42 26 44 32 Q48 28 56 28 Q56 32 50 36 Q42 42 42 56 Z" fill="#4F8A1B"/>
          <path d="M40 58 L40 50" stroke="#3B6D11" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="status-eyebrow eyebrow">order received · #0503-04</div>
      <h1 className="status-title">Order received, Maya.</h1>
      <p className="status-lede">
        Thanks. Annabel will text you Wednesday morning with delivery details.
      </p>

      <div className="confirm-card">
        <div className="confirm-card-head">
          <div className="eyebrow">summary</div>
          <span className="confirm-week mono">week of may 3</span>
        </div>
        <ul className="confirm-list">
          {items.map(i => (
            <li key={i.name}>
              <span className="confirm-line-name">
                <span className="confirm-qty mono">{i.qty}×</span>
                <span>{i.name}</span>
                <span className="confirm-unit"> · {i.unit}</span>
              </span>
              <span className="confirm-amt mono">${(i.qty * i.price).toFixed(2)}</span>
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
          <div className="confirm-fulfill-val">
            <div>Wed, May 6 · between 8am – noon</div>
            <div className="confirm-fulfill-sub">16100 Detroit Ave, Lakewood</div>
          </div>
        </div>
      </div>

      <div className="callout callout-info status-callout">
        <div>
          <strong>An invoice will follow from Annabel via Wave.</strong>
          <div style={{marginTop: 4, color: "var(--ink-700)"}}>
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

/* ── 3. Invalid link ────────────────────────────────────── */
function InvalidPage() {
  return (
    <StatusShell tone="muted">
      <div className="status-art">
        {/* broken/withered link icon */}
        <svg viewBox="0 0 200 140" width="180" height="126" aria-hidden="true">
          {/* broken stem */}
          <path d="M40 100 L80 70" stroke="#3B6D11" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round"/>
          <path d="M120 70 L160 40" stroke="#3B6D11" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round"/>
          {/* gap */}
          <circle cx="92" cy="62" r="2.5" fill="#3B6D11" opacity="0.4"/>
          <circle cx="100" cy="56" r="2" fill="#3B6D11" opacity="0.3"/>
          <circle cx="108" cy="62" r="2.5" fill="#3B6D11" opacity="0.4"/>
          {/* leaf ends */}
          <path d="M40 100 Q30 96 28 88 Q36 90 42 96 Z" fill="#3B6D11" opacity="0.45"/>
          <path d="M160 40 Q170 44 172 52 Q164 50 158 44 Z" fill="#3B6D11" opacity="0.45"/>
        </svg>
      </div>
      <div className="status-eyebrow eyebrow">link expired</div>
      <h1 className="status-title">This link doesn't work anymore.</h1>
      <p className="status-lede">
        Text Annabel and she'll send a fresh one.
      </p>
      <div className="status-actions">
        <a href="sms:2162025718" className="btn btn-primary status-btn">
          Text Annabel · 216-202-5718
        </a>
      </div>
      <p className="status-fine">
        Links expire when they're regenerated — usually if a phone changes hands
        at one of our partners.
      </p>
    </StatusShell>
  );
}

window.ClosedPage = ClosedPage;
window.ConfirmedPage = ConfirmedPage;
window.InvalidPage = InvalidPage;
