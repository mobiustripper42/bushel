import { StatusShell } from "@/components/customer/StatusShell";
import { weekOfLabel } from "@/lib/week";

export function AllSoldOutShell({ customerName }: { customerName: string }) {
  return (
    <StatusShell>
      <div className="status-eyebrow eyebrow">this week · {weekOfLabel()}</div>
      <h1 className="status-title">Everything is sold out for this week.</h1>
      <p className="status-lede">
        Hi, {customerName}. Check back next week — Annabel re-stocks Sunday and
        Monday. Text 216-202-5718 with any questions.
      </p>
    </StatusShell>
  );
}
