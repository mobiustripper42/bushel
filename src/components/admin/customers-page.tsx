"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Switch } from "@/components/ui/switch";
import { CustomerDrawer, type CustomerDrawerState } from "@/components/admin/customer-drawer";
import { toggleSubscribed } from "@/actions/toggle-subscribed";

export type CustomerRow = {
  id: string;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  delivery_address: string | null;
  priority: number;
  send_weekly_link: boolean;
  token: string;
};

type Props = { customers: CustomerRow[] };

function emptyDrawerState(): CustomerDrawerState {
  return {
    id: null,
    name: "",
    business_name: "",
    email: "",
    phone: "",
    delivery_address: "",
    priority: "100",
    send_weekly_link: true,
    token: "",
  };
}

function rowToDrawerState(row: CustomerRow): CustomerDrawerState {
  return {
    id: row.id,
    name: row.name,
    business_name: row.business_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    delivery_address: row.delivery_address ?? "",
    priority: String(row.priority),
    send_weekly_link: row.send_weekly_link,
    token: row.token,
  };
}

export function CustomersPage({ customers }: Props) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<CustomerDrawerState | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [, startToggle] = useTransition();

  const subscribedCount = customers.filter((c) => c.send_weekly_link).length;

  function handleSaved() {
    setDrawer(null);
    router.refresh();
  }

  function handleToggle(c: CustomerRow) {
    setToggleError(null);
    startToggle(async () => {
      let result;
      try {
        result = await toggleSubscribed(c.id, !c.send_weekly_link);
      } catch (e) {
        setToggleError(e instanceof Error ? e.message : "Couldn't update — try again.");
        router.refresh(); // resync UI to truth
        return;
      }
      if (result.error) {
        setToggleError(result.error);
      }
      router.refresh();
    });
  }

  async function handleCopy(c: CustomerRow) {
    const url = `${window.location.origin}/c/${c.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 1400);
    } catch {
      // Clipboard blocked — silent. Tokens are short enough to copy by hand.
    }
  }

  return (
    <main style={{ padding: "28px 32px 60px", maxWidth: 1200, width: "100%" }}>
      <PageHeader
        eyebrow={`${customers.length} account${customers.length === 1 ? "" : "s"} · ${subscribedCount} subscribed`}
        title="Customers"
      >
        <Button variant="secondary" disabled title="Coming later">
          Export CSV
        </Button>
        <Button variant="primary" onClick={() => setDrawer(emptyDrawerState())}>
          + Add customer
        </Button>
      </PageHeader>

      {toggleError && (
        <div role="alert" className="drawer-error" style={{ marginBottom: 16 }}>
          {toggleError}
        </div>
      )}

      <div className="cust-tableCard">
        <table className="cust-table">
          <thead>
            <tr>
              <th className="col-c-name">Name</th>
              <th className="col-c-contact">Contact</th>
              <th className="col-c-addr">Address</th>
              <th className="col-c-priority">Priority</th>
              <th className="col-c-link">Order link</th>
              <th className="col-c-sub">Subscribed</th>
              <th className="col-c-actions" aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--ink-500)" }}>
                  No active customers. Add one to get started.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr
                key={c.id}
                className={"cust-row" + (!c.send_weekly_link ? " is-unsub" : "")}
                data-row-id={c.id}
                data-row-name={c.name}
                onClick={() => setDrawer(rowToDrawerState(c))}
              >
                <td className="col-c-name">
                  <div className="cust-name">{c.name}</div>
                  {c.business_name && (
                    <div className="cust-biz">{c.business_name}</div>
                  )}
                  <div className="cust-name-token mono">/c/{c.token}</div>
                </td>
                <td className="col-c-contact">
                  {c.email && <div className="cust-email">{c.email}</div>}
                  {c.phone && <div className="cust-phone mono">{c.phone}</div>}
                </td>
                <td className="col-c-addr">
                  {c.delivery_address && (
                    <div className="cust-addr" title={c.delivery_address}>
                      {c.delivery_address}
                    </div>
                  )}
                </td>
                <td className="col-c-priority mono">{c.priority}</td>
                <td className="col-c-link" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={"cust-copy" + (copiedId === c.id ? " is-copied" : "")}
                    onClick={() => handleCopy(c)}
                    aria-label={`Copy order link for ${c.name}`}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="8" y="8" width="12" height="12" rx="2" />
                      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                    </svg>
                    <span>{copiedId === c.id ? "Copied!" : "Copy link"}</span>
                  </button>
                  <button
                    type="button"
                    className="cust-regen"
                    disabled
                    title="Token regenerate ships with 3.2"
                  >
                    Regenerate
                  </button>
                </td>
                <td className="col-c-sub" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={c.send_weekly_link}
                    onChange={() => handleToggle(c)}
                    ariaLabel={`Subscribed: ${c.name}`}
                  />
                </td>
                <td className="col-c-actions">
                  <span className="cust-chev" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawer && (
        <CustomerDrawer
          initial={drawer}
          onClose={() => setDrawer(null)}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
}
