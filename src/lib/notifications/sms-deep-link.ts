// `sms:` deep-link builder. Per DEC-026, Bushel does not send SMS itself;
// the admin send-queue surfaces `sms:` URIs as per-customer Send buttons that
// open the operator's native Messages app with the recipient and body
// pre-filled. RFC 5724 specifies `sms:NUMBER?body=...`; iOS 8+ and Android
// Chrome both honor this form.

export type SmsTarget = {
  phone: string;
  body: string;
};

export function buildSmsUrl({ phone, body }: SmsTarget): string {
  return `sms:${normalizePhone(phone)}?body=${encodeURIComponent(body)}`;
}

export function normalizePhone(raw: string): string {
  if (!raw) return "";
  const hasLeadingPlus = raw.trimStart().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  return hasLeadingPlus ? `+${digits}` : digits;
}
