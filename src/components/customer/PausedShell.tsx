import { StatusShell } from "@/components/customer/StatusShell";

// #130 — shown when an admin has either paused a customer's weekly link
// (send_weekly_link = false) or closed their account (is_active = false).
// Same shell shape as ClosedShell/AllSoldOutShell; copy varies on reason.
export function PausedShell({
  customerName,
  reason,
}: {
  customerName: string;
  reason: "paused" | "closed";
}) {
  const title =
    reason === "closed"
      ? "This account is closed."
      : "Your weekly order link is paused.";
  const lede =
    reason === "closed"
      ? `${customerName}. Text Annabel at 216-202-5718 if you'd like to come back.`
      : `${customerName}. Text Annabel at 216-202-5718 to resume.`;
  return (
    <StatusShell>
      <div className="status-eyebrow eyebrow">account</div>
      <h1 className="status-title">{title}</h1>
      <p className="status-lede">{lede}</p>
    </StatusShell>
  );
}
