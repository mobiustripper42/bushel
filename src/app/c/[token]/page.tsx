import { StatusShell } from "@/components/customer/StatusShell";

// TODO Phase 3: look up token — show InvalidPage if expired, OrderPage if open
// For now: ordering is always closed (correct for Phase 0)
export default function CustomerTokenPage() {
  return (
    <StatusShell>
      <div className="status-art" aria-hidden="true">
        <svg viewBox="0 0 240 160" width="220" height="146">
          <path d="M30 110 Q120 152 210 110" fill="none" stroke="#3B6D11" strokeOpacity="0.35" strokeWidth="1.5" />
          <path d="M40 108 Q120 138 200 108" fill="#EDF5E5" stroke="#3B6D11" strokeOpacity="0.5" strokeWidth="1" />
          <g transform="translate(60 92) rotate(-12)">
            <path d="M0 0 L48 4 L52 12 L4 14 Z" fill="#E6A817" />
            <path d="M-6 -6 Q-3 -10 0 -8 M-2 -10 Q1 -14 4 -12 M2 -8 Q5 -14 9 -10" stroke="#3B6D11" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          </g>
          <g transform="translate(120 80)">
            <ellipse cx="0" cy="14" rx="18" ry="14" fill="#B23B2E" opacity="0.85" />
            <path d="M-8 0 Q-6 -10 0 -12 M0 0 Q1 -12 6 -14 M6 0 Q10 -10 14 -8" stroke="#3B6D11" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </g>
          <g transform="translate(170 90)">
            <circle r="16" fill="#4F8A1B" opacity="0.85" />
            <circle r="11" fill="#5fa825" opacity="0.6" />
            <path d="M-10 -6 Q-4 -12 4 -10 M-6 0 Q2 -8 10 -4" stroke="#FBFAF5" strokeOpacity="0.6" strokeWidth="1" fill="none" />
          </g>
          <text x="100" y="36" fontFamily="serif" fontStyle="italic" fontSize="22" fill="#3B6D11" opacity="0.55">z</text>
          <text x="118" y="26" fontFamily="serif" fontStyle="italic" fontSize="16" fill="#3B6D11" opacity="0.4">z</text>
          <text x="132" y="20" fontFamily="serif" fontStyle="italic" fontSize="12" fill="#3B6D11" opacity="0.3">z</text>
        </svg>
      </div>

      <div className="status-eyebrow eyebrow">this week · closed</div>
      <h1 className="status-title">Ordering&rsquo;s closed for this week.</h1>
      <p className="status-lede">
        We open again <strong>Sunday morning</strong>. You&rsquo;ll get a text from Annabel
        when this week&rsquo;s list is up.
      </p>

      <div className="status-meta">
        <div className="status-meta-row">
          <span className="status-meta-key">Next opening</span>
          <span className="status-meta-val">Sun · ~8am</span>
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
