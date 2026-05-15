// `sms:` deep-link builder. Per DEC-026, Bushel does not send SMS itself;
// the admin send-queue surfaces `sms:` URIs as per-customer Send buttons that
// open the operator's native Messages app with the recipient and body
// pre-filled. RFC 5724 specifies `sms:NUMBER?body=...`; iOS 8+ and Android
// Chrome both honor this form.

export type SmsTarget = {
  phone: string;
  body: string;
};

// Builder is never-throw and always emits `?body=` (even for empty bodies) so
// callers get a single stable shape. Caller is responsible for validating that
// `phone` is non-empty and dialable — an empty phone produces `sms:?body=...`,
// which the OS will reject silently. Extension syntax (`555-1234 x123`) is not
// detected; non-digit chars are stripped wholesale, so extension digits glue
// onto the main number. See the spec for the pinned-behavior tests.
export function buildSmsUrl({ phone, body }: SmsTarget): string {
  return `sms:${normalizePhone(phone)}?body=${encodeURIComponent(body)}`;
}

export function normalizePhone(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasLeadingPlus ? `+${digits}` : digits;
}
