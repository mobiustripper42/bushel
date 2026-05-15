import { SendRow } from "@/components/admin/send-row";
import { IntroNoteCard } from "@/components/admin/intro-note-card";
import {
  SEND_MODES,
  getIntroNote,
  getOrderConfirmationQueue,
  getPickupReminderQueue,
  getWeeklyUpdateQueue,
  tokenUrl,
  type SendMode,
  type SendQueueRow,
} from "@/lib/admin/send-queue-queries";
import { weekOfMondayNY } from "@/lib/week";
import {
  orderConfirmationBody,
  pickupReminderBody,
  weeklyUpdateBody,
} from "@/lib/notifications/templates";

export const metadata = { title: "Send Update — Bay Branch Farm" };

const MODE_LABELS: Record<SendMode, string> = {
  weekly_update: "Weekly update",
  order_confirmation: "Order confirmation",
  pickup_reminder: "Pickup reminder",
};

const MODE_SUBTITLES: Record<SendMode, string> = {
  weekly_update:
    "Goes to every subscribed customer with the week's ordering link.",
  order_confirmation:
    "Confirms receipt to customers who placed an order this week.",
  pickup_reminder:
    "Reminds customers with an order this week that pickup is coming up.",
};

function isSendMode(value: string | undefined): value is SendMode {
  return value !== undefined && (SEND_MODES as string[]).includes(value);
}

function bodyFor(mode: SendMode, row: SendQueueRow, introNote: string): string {
  if (mode === "weekly_update") {
    return weeklyUpdateBody({
      customerName: row.customerName,
      tokenUrl: tokenUrl(row.token),
      introNote,
    });
  }
  if (mode === "order_confirmation") {
    return orderConfirmationBody({
      customerName: row.customerName,
      fulfillmentType: row.fulfillmentType ?? "pickup",
      pickupNote: row.pickupNote,
      deliveryPreference: row.deliveryPreference,
    });
  }
  return pickupReminderBody({ customerName: row.customerName });
}

export default async function SendPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams;
  const mode: SendMode = isSendMode(params.mode) ? params.mode : "weekly_update";
  const weekOf = weekOfMondayNY();

  const [rows, introNote] = await Promise.all([
    mode === "weekly_update"
      ? getWeeklyUpdateQueue()
      : mode === "order_confirmation"
        ? getOrderConfirmationQueue()
        : getPickupReminderQueue(),
    getIntroNote(),
  ]);

  const unsentCount = rows.filter((r) => r.sentAt === null).length;

  return (
    <div style={{ padding: "32px", maxWidth: 960, margin: "0 auto" }}>
      <div className="send-head">
        <div className="eyebrow">Send queue</div>
        <div className="send-title">Send Update</div>
        <div className="send-subtitle">{MODE_SUBTITLES[mode]}</div>
      </div>

      <nav className="send-mode-tabs" aria-label="Send mode">
        {SEND_MODES.map((m) => (
          <a
            key={m}
            href={m === "weekly_update" ? "/admin/send" : `/admin/send?mode=${m}`}
            className={"send-mode-tab" + (m === mode ? " is-active" : "")}
            aria-current={m === mode ? "page" : undefined}
          >
            {MODE_LABELS[m]}
          </a>
        ))}
      </nav>

      {mode === "weekly_update" && <IntroNoteCard initialValue={introNote} />}

      <div className="send-queue-meta">
        <span>
          <strong>{unsentCount}</strong> unsent · <strong>{rows.length}</strong> total
        </span>
        <span className="send-queue-meta-week">Week of {weekOf}</span>
      </div>

      {rows.length === 0 ? (
        <div className="send-empty">
          {mode === "weekly_update"
            ? "No subscribed customers yet."
            : "No orders this week to send for."}
        </div>
      ) : (
        <ul className="send-list" aria-label={`${MODE_LABELS[mode]} queue`}>
          {rows.map((row) => (
            <SendRow
              key={row.customerId}
              customerId={row.customerId}
              customerName={row.customerName}
              phone={row.phone}
              body={bodyFor(mode, row, introNote)}
              weekOf={weekOf}
              mode={mode}
              initialSentAt={row.sentAt}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

