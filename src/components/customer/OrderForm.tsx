"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { placeOrder } from "@/actions/place-order";
import type { ProductRow } from "@/lib/customer/queries";

type Customer = {
  id: string;
  name: string;
  delivery_address: string | null;
};

type Props = {
  customer: Customer;
  products: ProductRow[];
  priorDeliveryPreference: string | null;
  weekLabel: string;
};

type Mode = "delivery" | "pickup";

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

// Press-and-hold tuning: pause before repeating, then a steady cadence that
// accelerates after a few ticks so wholesale qty (24, 50…) is reachable
// without 50 taps. Manual feel — not exercised by tests.
const HOLD_DELAY_MS = 400;
const HOLD_TICK_MS = 90;
const HOLD_ACCEL_AFTER = 8;
const HOLD_FAST_TICK_MS = 40;

// After-press preview: thumb-friendly chip that lingers briefly after the
// pointer lifts so a single tap is still readable.
const PREVIEW_LINGER_MS = 600;

function triggerHaptic() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(10);
  }
}

function Stepper({
  value,
  onChange,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  max: number;
}) {
  const [draft, setDraft] = useState(value.toString());
  const [showPreview, setShowPreview] = useState(false);
  const valueRef = useRef(value);
  const maxRef = useRef(max);
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    valueRef.current = value;
    setDraft(value.toString());
  }, [value]);

  useEffect(() => {
    maxRef.current = max;
  }, [max]);

  const clamp = (n: number) => Math.max(0, Math.min(maxRef.current, n));

  const flashPreview = () => {
    setShowPreview(true);
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    previewTimeout.current = setTimeout(
      () => setShowPreview(false),
      PREVIEW_LINGER_MS,
    );
  };

  const step = (dir: 1 | -1) => {
    const next = clamp(valueRef.current + dir);
    if (next === valueRef.current) return false;
    valueRef.current = next;
    onChange(next);
    flashPreview();
    triggerHaptic();
    return true;
  };

  const stopHold = () => {
    if (holdTimeout.current) clearTimeout(holdTimeout.current);
    if (holdInterval.current) clearInterval(holdInterval.current);
    holdTimeout.current = null;
    holdInterval.current = null;
  };

  useEffect(
    () => () => {
      stopHold();
      if (previewTimeout.current) clearTimeout(previewTimeout.current);
    },
    [],
  );

  const startHold = (dir: 1 | -1) => {
    stopHold();
    holdTimeout.current = setTimeout(() => {
      let ticks = 0;
      const tick = () => {
        if (!step(dir)) {
          stopHold();
          return;
        }
        ticks += 1;
        // Defense in depth: only swap to fast cadence if the slow interval
        // is still ours (stopHold elsewhere would have nulled it).
        if (ticks === HOLD_ACCEL_AFTER && holdInterval.current) {
          clearInterval(holdInterval.current);
          holdInterval.current = setInterval(tick, HOLD_FAST_TICK_MS);
        }
      };
      holdInterval.current = setInterval(tick, HOLD_TICK_MS);
    }, HOLD_DELAY_MS);
  };

  const commitDraft = () => {
    const parsed = parseInt(draft, 10);
    const next = clamp(Number.isNaN(parsed) ? 0 : parsed);
    setDraft(next.toString());
    if (next !== valueRef.current) {
      valueRef.current = next;
      onChange(next);
    }
  };

  const canDec = value > 0;
  const canInc = value < max;

  return (
    <div className="stepper" role="group" aria-label="quantity">
      <div
        className={"stepper-preview" + (showPreview ? " is-visible" : "")}
        aria-hidden="true"
      >
        {value}
      </div>
      <button
        type="button"
        className="stepper-btn"
        onClick={() => step(-1)}
        onPointerDown={() => canDec && startHold(-1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        disabled={!canDec}
        aria-label="decrease"
      >
        −
      </button>
      <input
        className="stepper-val"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label="quantity value"
        min={0}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
      />
      <button
        type="button"
        className="stepper-btn"
        onClick={() => step(1)}
        onPointerDown={() => canInc && startHold(1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        disabled={!canInc}
        aria-label="increase"
      >
        +
      </button>
    </div>
  );
}

export function OrderForm({
  customer,
  products,
  priorDeliveryPreference,
  weekLabel,
}: Props) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<Mode>("delivery");
  const [pickupNote, setPickupNote] = useState("");
  const [deliveryPreference, setDeliveryPreference] = useState(
    priorDeliveryPreference ?? "",
  );
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const itemsWithQty = useMemo(
    () => products.filter((p) => (qty[p.id] ?? 0) > 0),
    [products, qty],
  );
  const subtotalCents = useMemo(
    () =>
      itemsWithQty.reduce((sum, p) => sum + (qty[p.id] ?? 0) * p.price_cents, 0),
    [itemsWithQty, qty],
  );
  const itemCount = useMemo(
    () => itemsWithQty.reduce((sum, p) => sum + (qty[p.id] ?? 0), 0),
    [itemsWithQty, qty],
  );
  const lineCount = itemsWithQty.length;

  const setItemQty = (id: string, n: number) =>
    setQty((q) => ({ ...q, [id]: n }));

  const handleSubmit = () => {
    if (lineCount === 0 || isPending) return;
    setSubmitError(null);
    const payloadItems = itemsWithQty.map((p) => ({
      product_id: p.id,
      qty: qty[p.id] ?? 0,
      unit_price_cents: p.price_cents,
    }));
    startTransition(async () => {
      const result = await placeOrder({
        mode,
        items: payloadItems,
        delivery_preference: deliveryPreference,
        pickup_note: pickupNote,
        notes,
      });
      if (result?.error) setSubmitError(result.error);
      // On success the action redirects; we never return here.
    });
  };

  // Disable + show spinner whenever a submit is in flight, regardless of
  // which of the three buttons the user pressed.
  const submitDisabled = lineCount === 0 || isPending;

  return (
    <div className="order-page">
      <div className="brand-strip">
        <div className="brand-mark">
          <span className="brand-leaf" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M21.5 2.5c0 8-4.5 14.5-12 14.5-1.4 0-2.8-.2-4-.7l1.4-1.4c.8.2 1.7.4 2.6.4 6 0 9.5-5.3 10-12.3-2 .6-7.4 2.6-10.4 7.4-1 1.6-1.5 3.4-1.7 5.4l-1.5 1.5c0-3.3.7-6.3 2.4-8.7C11.4 4 18.4 2.6 21.5 2.5z" />
            </svg>
          </span>
          <span className="brand-name">Bay Branch Farm</span>
        </div>
      </div>

      <div className="page-shell">
        <header className="page-head">
          <h1 className="page-title">What&rsquo;s available</h1>
          <div className="eyebrow page-head-week">this week · {weekLabel}</div>
          <p className="page-greet">
            Hi, <span className="customer-name">{customer.name}</span>.
          </p>
        </header>

        <div className="page-cols">
          <div className="page-main">
            <section className="inv">
              <div className="inv-head">
                <div className="eyebrow">availability</div>
                <span className="inv-count">
                  {products.filter((p) => p.qty_available > 0).length} items
                </span>
              </div>
              <div className="item-list">
                {products.map((p) => {
                  const current = qty[p.id] ?? 0;
                  const out = p.qty_available === 0;
                  const remaining = out ? 0 : p.qty_available - current;
                  return (
                    <div
                      key={p.id}
                      className={"item-row" + (out ? " is-sold-out" : "")}
                    >
                      <div className="item-thumb" aria-hidden="true">
                        <div className="item-thumb-inner"></div>
                      </div>
                      <div className="item-body">
                        <div className="item-line1">
                          <div className="item-name">{p.name}</div>
                          <div className="item-price">
                            <span className="mono">${formatPrice(p.price_cents)}</span>
                            <span className="item-per"> / {p.unit}</span>
                          </div>
                        </div>
                        <div className="item-line2">
                          {out ? (
                            <span className="item-meta meta-sold-out">Sold out</span>
                          ) : remaining <= 3 ? (
                            <span className="item-meta meta-low">
                              only {remaining} {p.unit}
                              {remaining !== 1 ? "s" : ""} left
                            </span>
                          ) : (
                            <span className="item-meta">
                              {remaining} {p.unit}
                              {remaining !== 1 ? "s" : ""} available
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="item-stepper">
                        <Stepper
                          value={current}
                          onChange={(n) => setItemQty(p.id, n)}
                          max={p.qty_available}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="fulfill">
              <div className="eyebrow">fulfillment</div>
              <h2 className="section-title">How would you like it?</h2>
              <div className="fulfill-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "delivery"}
                  className={"fulfill-tab" + (mode === "delivery" ? " is-active" : "")}
                  onClick={() => setMode("delivery")}
                >
                  <div className="fulfill-tab-label">Delivery</div>
                  <div className="fulfill-tab-sub">Wednesday morning</div>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "pickup"}
                  className={"fulfill-tab" + (mode === "pickup" ? " is-active" : "")}
                  onClick={() => setMode("pickup")}
                >
                  <div className="fulfill-tab-label">Pickup at farm</div>
                  <div className="fulfill-tab-sub">3612 W 114th, Cleveland</div>
                </button>
              </div>

              {mode === "delivery" ? (
                <div className="fulfill-detail">
                  <div className="addr-stack">
                    <div className="label-sm">Delivery to</div>
                    <div className="addr-text">
                      {customer.delivery_address ?? "(no address on file — text Annabel)"}
                    </div>
                  </div>
                  <label className="field-label" htmlFor="delivery-pref">
                    Delivery preference
                  </label>
                  <textarea
                    id="delivery-pref"
                    className="textarea"
                    rows={3}
                    placeholder="e.g. Leave at back door, gate code 4321."
                    value={deliveryPreference}
                    onChange={(e) => setDeliveryPreference(e.target.value)}
                  />
                  <div className="fulfill-help">
                    Wednesday between 8am and noon. We&rsquo;ll text when we&rsquo;re 30 minutes out.
                  </div>
                </div>
              ) : (
                <div className="fulfill-detail">
                  <label className="field-label" htmlFor="pickup-note">
                    When are you picking up?
                  </label>
                  <textarea
                    id="pickup-note"
                    className="textarea"
                    rows={3}
                    placeholder="e.g. Wednesday afternoon, around 3."
                    value={pickupNote}
                    onChange={(e) => setPickupNote(e.target.value)}
                  />
                  <div className="fulfill-help">
                    Pick up at the farm. Annabel will text you the morning of.
                  </div>
                </div>
              )}
            </section>

            <section className="notes">
              <div className="eyebrow">notes</div>
              <h2 className="section-title">Anything else?</h2>
              <textarea
                className="textarea"
                rows={3}
                placeholder="Optional. Anything Annabel should know — substitutions you're open to, bunch sizes, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </section>

            <section className="submit-block">
              <div className="submit-summary">
                <div className="summary-line">
                  <span className="summary-label">
                    {lineCount} item{lineCount !== 1 ? "s" : ""}
                  </span>
                  <span className="summary-total mono">
                    ${formatPrice(subtotalCents)}
                  </span>
                </div>
                <div className="summary-sub">
                  {mode === "delivery"
                    ? customer.delivery_address
                      ? `Wednesday delivery to ${customer.delivery_address.split(",")[0]}`
                      : "Wednesday delivery"
                    : "Pickup at the farm"}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary submit-btn"
                onClick={handleSubmit}
                disabled={submitDisabled}
                aria-busy={isPending}
              >
                {isPending ? (
                  <span className="btn-spinner" aria-hidden="true" />
                ) : (
                  "Submit order"
                )}
              </button>
              {submitError ? (
                <p className="submit-error" role="alert">
                  {submitError}
                </p>
              ) : null}
              <p className="submit-fine">
                You&rsquo;ll get a text confirmation. To change anything, text
                Annabel at 216-202-5718.
              </p>
            </section>
          </div>

          <aside className="page-rail">
            <div className="rail-card">
              <div className="eyebrow">your order</div>
              {lineCount === 0 ? (
                <div className="rail-empty">
                  Nothing selected yet. Tap <span className="mono">+</span> on
                  items above.
                </div>
              ) : (
                <ul className="rail-list">
                  {itemsWithQty.map((p) => (
                    <li key={p.id}>
                      <span className="rail-name">
                        <span className="rail-qty mono">{qty[p.id]}×</span>{" "}
                        {p.name}
                      </span>
                      <span className="rail-amt mono">
                        ${formatPrice((qty[p.id] ?? 0) * p.price_cents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="rail-totals">
                <div className="rail-row rail-row-total">
                  <span>Total</span>
                  <span className="mono">${formatPrice(subtotalCents)}</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary rail-submit"
                onClick={handleSubmit}
                disabled={submitDisabled}
                aria-busy={isPending}
              >
                {isPending ? (
                  <span className="btn-spinner" aria-hidden="true" />
                ) : (
                  "Submit order"
                )}
              </button>
              <div className="rail-fine">
                Text Annabel to change anything · 216-202-5718
              </div>
            </div>
          </aside>
        </div>

        <footer className="page-foot">
          <div>Bay Branch Farm · 3612 W 114th St, Cleveland</div>
        </footer>
      </div>

      <div className={"sticky-bar" + (lineCount > 0 ? " is-active" : "")}>
        <div className="sticky-summary">
          <div className="sticky-count">
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </div>
          <div className="sticky-total mono">${formatPrice(subtotalCents)}</div>
        </div>
        <button
          type="button"
          className="btn btn-primary sticky-btn"
          onClick={handleSubmit}
          disabled={submitDisabled}
          aria-busy={isPending}
        >
          {isPending ? (
            <span className="btn-spinner" aria-hidden="true" />
          ) : (
            "Review & submit"
          )}
        </button>
      </div>
    </div>
  );
}
