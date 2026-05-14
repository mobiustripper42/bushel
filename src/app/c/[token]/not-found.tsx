import { StatusShell } from "@/components/customer/StatusShell";

export default function CustomerTokenNotFound() {
  return (
    <StatusShell>
      <div className="status-art">
        <svg
          viewBox="0 0 200 140"
          width="180"
          height="126"
          aria-hidden="true"
        >
          <path
            d="M40 100 L80 70"
            stroke="#3B6D11"
            strokeOpacity="0.5"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M120 70 L160 40"
            stroke="#3B6D11"
            strokeOpacity="0.5"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="92" cy="62" r="2.5" fill="#3B6D11" opacity="0.4" />
          <circle cx="100" cy="56" r="2" fill="#3B6D11" opacity="0.3" />
          <circle cx="108" cy="62" r="2.5" fill="#3B6D11" opacity="0.4" />
          <path
            d="M40 100 Q30 96 28 88 Q36 90 42 96 Z"
            fill="#3B6D11"
            opacity="0.45"
          />
          <path
            d="M160 40 Q170 44 172 52 Q164 50 158 44 Z"
            fill="#3B6D11"
            opacity="0.45"
          />
        </svg>
      </div>
      <div className="status-eyebrow eyebrow">link expired</div>
      <h1 className="status-title">This link doesn&rsquo;t work anymore.</h1>
      <p className="status-lede">Text Annabel and she&rsquo;ll send a fresh one.</p>
      <div className="status-actions">
        <a href="sms:2162025718" className="btn btn-primary status-btn">
          Text Annabel · 216-202-5718
        </a>
      </div>
      <p className="status-fine">
        Links expire when they&rsquo;re regenerated — usually if a phone changes
        hands at one of our partners.
      </p>
    </StatusShell>
  );
}
