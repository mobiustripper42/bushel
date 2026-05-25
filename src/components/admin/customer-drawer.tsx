"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { saveCustomer } from "@/actions/save-customer";
import { deactivateCustomer } from "@/actions/deactivate-customer";
import { reactivateCustomer } from "@/actions/reactivate-customer";
import { useUnsavedChangesGuard } from "@/lib/hooks/use-unsaved-changes-guard";

export type CustomerDrawerState = {
  id: string | null;
  name: string;
  business_name: string;
  email: string;
  phone: string;
  delivery_address: string;
  // Held as string so an empty field doesn't silently coerce to 0 (highest
  // send-queue position). Parsed at save.
  priority: string;
  send_weekly_link: boolean;
  token: string;
  // #61 — when false, the drawer swaps "Delete customer" for "Reactivate".
  is_active: boolean;
};

type Props = {
  initial: CustomerDrawerState;
  onClose: () => void;
  onSaved: () => void;
};

export function CustomerDrawer({ initial, onClose, onSaved }: Props) {
  const [c, setC] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [reactivating, startReactivating] = useTransition();
  const isNew = !initial.id;
  const isInactive = !isNew && !initial.is_active;
  // #129 — guard against leaving with unsaved edits. Suspend during
  // saving/deleting/reactivating so the success path (which fires
  // onSaved → unmount) doesn't bounce against the guard.
  const dirty = JSON.stringify(c) !== JSON.stringify(initial);
  const guardActive = dirty && !saving && !deleting && !reactivating;
  useUnsavedChangesGuard(guardActive);

  // The drawer's scrim click + X button + Escape all close without
  // navigating, so the hook's click/popstate path doesn't catch them.
  // Wrap onClose to prompt explicitly when dirty.
  function tryClose() {
    if (guardActive && !window.confirm("You have unsaved changes — leave anyway?")) {
      return;
    }
    onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") tryClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // tryClose closes over guardActive/onClose — re-bind when either changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardActive, onClose]);

  function set<K extends keyof CustomerDrawerState>(key: K, value: CustomerDrawerState[K]) {
    setC((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function handleSave() {
    setError(null);
    const priority = c.priority.trim() === "" ? NaN : parseInt(c.priority, 10);
    if (!Number.isFinite(priority)) {
      setError("Priority must be a whole number, zero or greater.");
      return;
    }
    startSaving(async () => {
      let result;
      try {
        result = await saveCustomer({
          id: c.id,
          name: c.name,
          business_name: c.business_name || null,
          email: c.email || null,
          phone: c.phone || null,
          delivery_address: c.delivery_address || null,
          priority,
          send_weekly_link: c.send_weekly_link,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed. Try again.");
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  function handleDelete() {
    if (!c.id) return;
    startDeleting(async () => {
      let result;
      try {
        result = await deactivateCustomer(c.id!);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Deactivate failed. Try again.");
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  function handleReactivate() {
    if (!c.id) return;
    startReactivating(async () => {
      let result;
      try {
        result = await reactivateCustomer(c.id!);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Reactivate failed. Try again.");
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <>
      <div className="drawer-scrim" onClick={tryClose} aria-hidden="true" />
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Add a new customer" : `Edit ${initial.name}`}
      >
        <header className="drawer-head">
          <div>
            <div className="eyebrow">
              {isNew ? "new customer" : isInactive ? "deactivated customer" : "edit customer"}
            </div>
            <h2 className="drawer-title">
              {isNew ? "Add a new customer" : initial.name || "—"}
            </h2>
            {!isNew && <div className="drawer-token mono">/c/{c.token}</div>}
          </div>
          <button
            type="button"
            className="drawer-close"
            onClick={tryClose}
            aria-label="Close drawer"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12 M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="drawer-body">
          {error && (
            <div role="alert" className="drawer-error" style={{ marginTop: 0, marginBottom: 20 }}>
              {error}
            </div>
          )}

          <Field label="Customer name" hint="How you refer to them. Often a short version of the business.">
            <input
              type="text"
              value={c.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. West Side Market"
              autoFocus
            />
          </Field>

          <Field label="Business name" hint="Full legal or trading name. Optional.">
            <input
              type="text"
              value={c.business_name}
              onChange={(e) => set("business_name", e.target.value)}
              placeholder="West Side Market — Bay Stand LLC"
            />
          </Field>

          <div className="field-row">
            <Field label="Email">
              <input
                type="email"
                value={c.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="orders@…"
              />
            </Field>
            <Field label="Phone (required)">
              <input
                type="tel"
                value={c.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="216-555-0100"
              />
            </Field>
          </div>
          <div className="field-help">Phone is required — that&apos;s how weekly SMS links go out. Email is optional.</div>

          <Field label="Delivery address" hint="Used on order confirmations and the delivery list.">
            <textarea
              rows={3}
              value={c.delivery_address}
              onChange={(e) => set("delivery_address", e.target.value)}
              placeholder="Street, city, zip"
            />
          </Field>

          <Field label="Priority" hint="Send-queue order. Lower goes first; 100 is the neutral default.">
            <input
              type="number"
              min={0}
              step={1}
              value={c.priority}
              onChange={(e) => set("priority", e.target.value)}
            />
          </Field>

          <Field label="Subscribed" hint="When off, they won't receive this week's order link.">
            <div className="field-switch-row">
              <Switch
                checked={c.send_weekly_link}
                onChange={(v) => set("send_weekly_link", v)}
                ariaLabel="Subscribed"
              />
              <span className="field-switch-label">
                {c.send_weekly_link ? "Will receive this week's link" : "Paused"}
              </span>
            </div>
          </Field>
        </div>

        <footer className="drawer-foot">
          {!isNew && !isInactive && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || saving}
            >
              {deleting ? "Deactivating…" : "Delete customer"}
            </Button>
          )}
          {isInactive && (
            <Button
              variant="primary"
              onClick={handleReactivate}
              disabled={reactivating || saving || deleting}
            >
              {reactivating ? "Reactivating…" : "Reactivate customer"}
            </Button>
          )}
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={tryClose} disabled={saving || deleting || reactivating}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || deleting || reactivating}>
            {saving ? "Saving…" : isNew ? "Add customer" : "Save changes"}
          </Button>
        </footer>
      </aside>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-control">{children}</span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
