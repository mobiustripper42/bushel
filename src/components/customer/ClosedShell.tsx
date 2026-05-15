import { StatusShell } from "@/components/customer/StatusShell";
import { weekOfLabel } from "@/lib/week";

export function ClosedShell({ customerName }: { customerName: string }) {
  return (
    <StatusShell>
      <div className="status-eyebrow eyebrow">this week · {weekOfLabel()}</div>
      <h1 className="status-title">Orders are closed this week.</h1>
      <p className="status-lede">
        Hi, {customerName}. Annabel will text you when we re-open. Text
        216-202-5718 with any questions.
      </p>
    </StatusShell>
  );
}
