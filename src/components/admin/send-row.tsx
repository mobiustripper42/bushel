"use client";

import { useState } from "react";

import { SendAction } from "@/components/admin/send-action";
import type { SendMode } from "@/lib/admin/send-queue-queries";

type SendRowProps = {
  customerId: string;
  customerName: string;
  phone: string | null;
  body: string;
  weekOf: string;
  mode: SendMode;
  initialSentAt: string | null;
};

// Send-page queue row. The send mechanics + status/action UI live in the shared
// SendAction component (#191); this owns the row layout (name/phone) and mirrors
// SendAction's sent-state onto the <li data-sent> the tests + CSS key off.
export function SendRow({
  customerId,
  customerName,
  phone,
  body,
  weekOf,
  mode,
  initialSentAt,
}: SendRowProps) {
  const [isSent, setIsSent] = useState(initialSentAt !== null);

  return (
    <li className="send-row" data-customer-id={customerId} data-sent={isSent ? "true" : "false"}>
      <div className="send-row-name">
        <div className="send-row-customer">{customerName}</div>
        <div className="send-row-phone">{phone ?? "no phone on file"}</div>
      </div>
      <SendAction
        customerId={customerId}
        phone={phone}
        body={body}
        weekOf={weekOf}
        mode={mode}
        initialSentAt={initialSentAt}
        revalidate="/admin/send"
        onSentChange={setIsSent}
      />
    </li>
  );
}
