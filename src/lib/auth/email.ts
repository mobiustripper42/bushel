/**
 * Login-code email (DEC-047). Resend's HTTP API called with plain `fetch` — no
 * SDK, same env-key+fetch shape as muster's email-channel.ts, so it clears the
 * dependency bar. Auth-only: this is not a notification channel (DEC-047 amends
 * DEC-033's rationale but not its outcome — alerting stays on its own path).
 *
 * Throws on a missing config or a non-2xx from Resend. The caller schedules the
 * send off the request hot path (`after()`), so a throw never reaches the admin
 * and a matched email isn't observably slower than a miss (no timing oracle).
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendLoginCode(to: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and RESEND_FROM must be set to send login codes");
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Your Bay Branch Farm sign-in code",
      text:
        `Your sign-in code is ${code}\n\n` +
        `It expires in 10 minutes. If you didn't request this, ignore this email.`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${detail}`);
  }
}
