import { SendRow } from "@/components/admin/send-row";
import { IntroNoteCard } from "@/components/admin/intro-note-card";
import {
  getIntroNote,
  getWeeklyUpdateQueue,
  tokenUrl,
} from "@/lib/admin/send-queue-queries";
import { weekOfMondayNY } from "@/lib/week";
import { weeklyUpdateBody } from "@/lib/notifications/templates";

export const metadata = { title: "Send Texts — Bay Branch Farm" };

// One mode only: the weekly ordering-link text to every subscribed customer.
// Order-confirmation and pickup-reminder sends moved onto the Orders page
// (#190), so the mode tabs and their queue loaders are gone (#189).
export default async function SendPage() {
  const weekOf = weekOfMondayNY();

  const [rows, introNote] = await Promise.all([
    getWeeklyUpdateQueue(),
    getIntroNote(),
  ]);

  const unsentCount = rows.filter((r) => r.sentAt === null).length;

  return (
    <div className="send-page">
      <div className="send-head">
        <div className="eyebrow">Send queue</div>
        <div className="send-title">Send Texts</div>
        <div className="send-subtitle">
          Send a text to each subscribed customer.
        </div>
      </div>

      <IntroNoteCard initialValue={introNote} />

      <div className="send-queue-meta">
        <span>
          <strong>{unsentCount}</strong> unsent · <strong>{rows.length}</strong> total
        </span>
        <span className="send-queue-meta-week">Week of {weekOf}</span>
      </div>

      {rows.length === 0 ? (
        <div className="send-empty">No subscribed customers yet.</div>
      ) : (
        <ul className="send-list" aria-label="Weekly update queue">
          {rows.map((row) => (
            <SendRow
              key={row.customerId}
              customerId={row.customerId}
              customerName={row.customerName}
              phone={row.phone}
              body={weeklyUpdateBody({
                customerName: row.customerName,
                tokenUrl: tokenUrl(row.token),
                introNote,
              })}
              weekOf={weekOf}
              mode="weekly_update"
              initialSentAt={row.sentAt}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
