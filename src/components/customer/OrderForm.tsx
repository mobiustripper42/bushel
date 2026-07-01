"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { placeOrder } from "@/actions/place-order";
import type { ProductRow, ProductUnitRow } from "@/lib/customer/queries";

type Customer = {
  id: string;
  name: string;
  delivery_address: string | null;
};

// #211 / DEC-039 — when set, the form is in ADD MODE: new items append to
// this existing (customer, week) order. Fulfillment is shown read-only
// (inherited from the order; change = text Annabel, DEC-015) and the submit
// payload sends only the new line items — never fulfillment fields.
export type ExistingOrderItem = {
  id: string;
  name: string;
  unitLabel: string;
  qty: number;
  unit_price_cents: number;
};

export type ExistingOrderFulfillment = {
  fulfillment_type: string;
  delivery_address: string | null;
  delivery_preference: string | null;
  pickup_note: string | null;
  // 9.1/DEC-039 — the order's already-placed lines, rendered read-only above
  // the editable additions so the summary shows the complete order.
  items: ExistingOrderItem[];
};

type Props = {
  customer: Customer;
  products: ProductRow[];
  priorDeliveryPreference: string | null;
  weekLabel: string;
  existingOrder: ExistingOrderFulfillment | null;
};

type Mode = "delivery" | "pickup";

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

// 9.1/DEC-039 — the already-placed lines, shown read-only above the editable
// additions in each "your order" card (rendered in both the inline summary and
// the desktop rail, hence a shared component rather than a duplicated .map).
function ExistingItemsGroup({ items }: { items: ExistingOrderItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rail-existing">
      <div className="rail-existing-head">Already ordered</div>
      <ul className="rail-list rail-list-existing">
        {items.map((it) => (
          <li key={it.id}>
            <span className="rail-name">
              <span className="rail-qty mono">{it.qty}×</span> {it.name}
              {it.unitLabel ? (
                <span className="rail-unit"> · {it.unitLabel}</span>
              ) : null}
            </span>
            <span className="rail-amt mono">
              ${formatPrice(it.qty * it.unit_price_cents)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// A server action's redirect() throws NEXT_REDIRECT on the client, which lands
// in our submit catch. It carries a `digest` string like "NEXT_REDIRECT;…".
// Distinguish it from a real failure so the success path doesn't get treated
// as an error (and doesn't restore the cart draft we just cleared).
function isRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
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
  existingOrder,
}: Props) {
  const addMode = existingOrder !== null;
  const [qty, setQty] = useState<Record<string, number>>({});
  // selectedUnit[productId] → product_units.id. Unset entries fall back to the
  // product's first active unit at render time. Switching units zeros qty for
  // that product (per #153 AC) — see the radio onChange handler below.
  const [selectedUnit, setSelectedUnit] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<Mode>("delivery");
  const [pickupNote, setPickupNote] = useState("");
  const [deliveryPreference, setDeliveryPreference] = useState(
    priorDeliveryPreference ?? "",
  );
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // useTransition's isPending flips asynchronously — a fast cross-button tap
  // (sticky-bar → rail-card) within one frame can fire the handler twice
  // before React commits the disabled state. This ref is the synchronous
  // latch; the server action is idempotent on the second call (same
  // submission_id → replay no-op, DEC-039) but the second request still hits
  // the network unnecessarily.
  const submittingRef = useRef(false);
  // #149 — once a submit is in flight we stop persisting: the redirect on
  // success unmounts before any post-await code runs, and a re-render during
  // the submit transition would otherwise re-fire the persist effect and
  // resurrect the draft we just cleared. Reset on a failed submit.
  const submittedRef = useRef(false);
  // #211 / DEC-039 — per-submit-attempt idempotency key. Minted lazily on the
  // first submit and REUSED on a retry of the unchanged cart, so a retry of a
  // submit that actually committed server-side (network error after the write)
  // replays as a no-op instead of appending the cart twice. Any cart edit
  // resets it (in the persist effect below): an edited cart is a new
  // submission, and reusing the old id would make the server short-circuit it.
  const submissionIdRef = useRef<string | null>(null);
  const fulfillRef = useRef<HTMLElement>(null);

  // #149 — persist the in-progress cart to sessionStorage so a reload or an
  // Android orientation change (which can evict the bfcache and remount this
  // component) doesn't wipe it. Keyed by customer so drafts can't bleed across
  // tokens in one tab. sessionStorage, not localStorage: it survives a same-tab
  // reload but not a tab close — a tokened weekly order shouldn't resurrect days
  // later (matches the AC: reopen via SMS link = fresh order).
  const draftKey = `bushel:cart:${customer.id}`;
  const [hydrated, setHydrated] = useState(false);

  const writeDraft = () => {
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ qty, selectedUnit, mode, pickupNote, deliveryPreference, notes }),
      );
    } catch {
      // Private-mode / quota / storage disabled — persistence is best-effort.
    }
  };
  const clearDraft = () => {
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      // ignore — see writeDraft
    }
  };

  // Hydrate once on mount (client-only — sessionStorage is undefined during
  // SSR). A stored qty/unit for a product that's since gone sold-out or hidden
  // is harmless: itemsWithQty filters against the live product list and unitFor
  // falls back to the first active unit.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.qty && typeof d.qty === "object") setQty(d.qty);
        if (d.selectedUnit && typeof d.selectedUnit === "object") setSelectedUnit(d.selectedUnit);
        if (d.mode === "delivery" || d.mode === "pickup") setMode(d.mode);
        if (typeof d.pickupNote === "string") setPickupNote(d.pickupNote);
        if (typeof d.deliveryPreference === "string") setDeliveryPreference(d.deliveryPreference);
        if (typeof d.notes === "string") setNotes(d.notes);
      }
    } catch {
      // Corrupt/unreadable draft — start fresh.
    }
    setHydrated(true);
    // Mount-only; draftKey is stable for the component's life (customer.id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every cart-state change — but only after hydration, so the
  // initial empty state on first render can't clobber a stored draft before
  // the mount effect loads it.
  useEffect(() => {
    if (!hydrated || submittedRef.current) return;
    // Cart state changed → this is no longer the same submission attempt.
    // Drop the idempotency key so the next submit mints a fresh one (see
    // submissionIdRef above). No-op on mount (ref starts null).
    submissionIdRef.current = null;
    writeDraft();
    // writeDraft closes over the current state; deps list the persisted fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, qty, selectedUnit, mode, pickupNote, deliveryPreference, notes]);

  const scrollToFulfill = () => {
    fulfillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const itemsWithQty = useMemo(
    () => products.filter((p) => (qty[p.id] ?? 0) > 0),
    [products, qty],
  );

  // Resolve a product's currently-selected unit. The selectedUnit map is
  // sparse — products the user hasn't touched fall through to the first
  // active unit, which 6.5a guarantees exists. Stale ids (e.g. an admin
  // deactivated a unit mid-session) silently revert to the same default.
  const unitFor = (p: ProductRow): ProductUnitRow | null => {
    const id = selectedUnit[p.id] ?? p.units[0]?.id;
    return p.units.find((u) => u.id === id) ?? p.units[0] ?? null;
  };

  const subtotalCents = useMemo(
    () =>
      itemsWithQty.reduce((sum, p) => {
        // unitFor only returns null when every unit is deactivated — that row
        // isn't submittable (handleSubmit drops it), so it contributes $0.
        const price = unitFor(p)?.unit_price_cents ?? 0;
        return sum + (qty[p.id] ?? 0) * price;
      }, 0),
    // unitFor reads selectedUnit; rebuild the subtotal when either map shifts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemsWithQty, qty, selectedUnit],
  );
  const itemCount = useMemo(
    () => itemsWithQty.reduce((sum, p) => sum + (qty[p.id] ?? 0), 0),
    [itemsWithQty, qty],
  );
  const lineCount = itemsWithQty.length;

  // 9.1/DEC-039 — in add mode the "your order" total is the *grand* total:
  // already-ordered lines + new additions. Submit still appends only the
  // additions (the RPC is unchanged); the total is informational (no charge
  // at submit — Annabel invoices via Wave).
  const existingSubtotalCents = (existingOrder?.items ?? []).reduce(
    (sum, it) => sum + it.qty * it.unit_price_cents,
    0,
  );
  const grandTotalCents = existingSubtotalCents + subtotalCents;

  const setItemQty = (id: string, n: number) => {
    // Belt-and-suspenders with the persist effect: editing the cart starts a
    // new submission attempt, so drop the idempotency key here at the edit
    // site too — a changed cart must never be swallowed as a replay no-op.
    submissionIdRef.current = null;
    setQty((q) => ({ ...q, [id]: n }));
  };

  const handleSubmit = () => {
    if (lineCount === 0 || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitError(null);
    // Payload identifies the selected unit; place_order looks up the
    // canonical unit_price_cents + conversion_to_base from product_units
    // at RPC time (6.5d). unit_price_cents is sent for display continuity
    // but the RPC ignores it — strict "price at moment of order" semantics.
    // #149 — a hydrated draft can carry qty for a product whose units were all
    // deactivated since it was saved; unitFor then returns null. Drop those
    // rather than dereference u!.id (a crash persistence newly made reachable).
    // The row still renders as sold-out; it just isn't submittable.
    const payloadItems = itemsWithQty.flatMap((p) => {
      const u = unitFor(p);
      if (!u) return [];
      return [
        {
          product_id: p.id,
          product_unit_id: u.id,
          qty: qty[p.id] ?? 0,
          unit_price_cents: u.unit_price_cents,
        },
      ];
    });
    if (payloadItems.length === 0) {
      setSubmitError("Those items are no longer available. Reload to see what's in stock.");
      submittingRef.current = false;
      return;
    }
    // Lazily mint the submission id; a retry of the unchanged cart reuses it
    // (the persist effect resets it on any cart edit).
    if (!submissionIdRef.current) {
      submissionIdRef.current = crypto.randomUUID();
    }
    const submissionId = submissionIdRef.current;
    // #211 / DEC-039 — in add mode the order's fulfillment is inherited, not
    // edited: send the existing order's mode for the RPC's (ignored-on-append)
    // fulfillment args and empty preference/note fields so the form never
    // tries to mutate them.
    const effectiveMode: Mode =
      existingOrder !== null
        ? existingOrder.fulfillment_type === "pickup"
          ? "pickup"
          : "delivery"
        : mode;
    // #149 — latch off persistence and clear the draft up front. On success the
    // action redirects and unmounts before any post-await code reliably runs,
    // so we can't clear there; on failure the error branches below unlatch and
    // re-persist so a rotation after a failed submit still keeps the cart.
    submittedRef.current = true;
    clearDraft();
    startTransition(async () => {
      try {
        const result = await placeOrder({
          mode: effectiveMode,
          items: payloadItems,
          delivery_preference: addMode ? "" : deliveryPreference,
          pickup_note: addMode ? "" : pickupNote,
          notes,
          submission_id: submissionId,
        });
        if (result?.error) {
          setSubmitError(result.error);
          submittingRef.current = false; // allow retry after a failed submit
          submittedRef.current = false; // re-enable persistence
          writeDraft(); // restore the draft we optimistically cleared
        }
        // On success the action redirects; page unmounts, latch stays true.
      } catch (err) {
        // A server-action redirect() surfaces here as a thrown NEXT_REDIRECT —
        // that's the SUCCESS path (order placed, Next is navigating to
        // /confirmed). Leave the draft cleared and the latch set; the page is
        // unmounting. Only a genuine failure restores the draft + unlatches.
        if (isRedirectError(err)) return;
        // Thrown errors (network failure, action exception) used to leave the
        // ref stuck true and silently swallow every subsequent click. Reset.
        setSubmitError(err instanceof Error ? err.message : "Submit failed.");
        submittingRef.current = false;
        submittedRef.current = false; // re-enable persistence
        writeDraft(); // restore the draft we optimistically cleared
      }
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
            <span className="customer-name">{customer.name}</span>
          </p>
        </header>

        <div className="page-cols">
          <div className="page-main">
            <section className="inv">
              <div className="inv-head">
                <div className="eyebrow">availability</div>
              </div>
              <div className="item-list">
                {products.map((p) => {
                  const current = qty[p.id] ?? 0;
                  const selected = unitFor(p);
                  const conv = selected?.conversion_to_base ?? 1;
                  const label = selected?.label ?? "";
                  const priceCents = selected?.unit_price_cents ?? 0;
                  // Per-unit max: number of selected-unit chunks that fit in
                  // current base inventory. Floors fractional remainders so
                  // the stepper never offers a quantity that would oversell.
                  const perUnitMax = Math.floor(p.qty_available / conv);
                  // 6.5d: a product is "out" when no active unit fits in the
                  // remaining base inventory — qty_available=2 with only a
                  // conv=4 unit active is sold out, not "0 lbs left".
                  const out =
                    p.qty_available === 0 ||
                    !p.units.some((u) => p.qty_available >= u.conversion_to_base);
                  // Math.max guards the rare case where the selected unit's
                  // perUnitMax dropped below the in-cart qty mid-session
                  // (inventory reduced under our feet). Don't render
                  // "only -2 lbs left".
                  const remaining = out ? 0 : Math.max(0, perUnitMax - current);
                  const showPicker = p.units.length >= 2;
                  return (
                    <div
                      key={p.id}
                      className={
                        "item-row" +
                        (out ? " is-sold-out" : "") +
                        (showPicker ? " has-picker" : "")
                      }
                    >
                      <div className="item-body">
                        <div className="item-name">{p.name}</div>
                        {p.description ? (
                          <div className="item-desc">{p.description}</div>
                        ) : null}
                        <div className="item-meta-row">
                          <span className="item-price">
                            <span className="mono">${formatPrice(priceCents)}</span>
                            <span className="item-per"> / {label}</span>
                          </span>
                          {out ? (
                            <span className="item-meta meta-sold-out">Sold out</span>
                          ) : remaining <= 3 ? (
                            <span className="item-meta meta-low">
                              only {remaining} {label}
                              {remaining !== 1 ? "s" : ""} left
                            </span>
                          ) : (
                            <span className="item-meta">
                              {remaining} {label}
                              {remaining !== 1 ? "s" : ""} available
                            </span>
                          )}
                        </div>
                        {showPicker ? (
                          <div
                            className="unit-picker"
                            role="radiogroup"
                            aria-label={`${p.name} unit`}
                          >
                            {p.units.map((u) => {
                              const disabled = p.qty_available < u.conversion_to_base;
                              const isSel = u.id === selected?.id;
                              return (
                                <label
                                  key={u.id}
                                  className={
                                    "unit-option" +
                                    (isSel ? " is-selected" : "") +
                                    (disabled ? " is-disabled" : "")
                                  }
                                >
                                  <input
                                    type="radio"
                                    name={`unit-${p.id}`}
                                    value={u.id}
                                    checked={isSel}
                                    disabled={disabled}
                                    onChange={() => {
                                      setSelectedUnit((s) => ({ ...s, [p.id]: u.id }));
                                      setItemQty(p.id, 0);
                                    }}
                                  />
                                  <span className="unit-option-label">{u.label}</span>
                                  <span className="unit-option-price mono">
                                    ${formatPrice(u.unit_price_cents)}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                      <div className="item-stepper">
                        <Stepper
                          value={current}
                          onChange={(n) => setItemQty(p.id, n)}
                          max={perUnitMax}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {addMode && existingOrder ? (
              // #211 / DEC-039 — add mode inherits the order's fulfillment.
              // Read-only summary, no inputs: customers don't edit fulfillment
              // (DEC-015) — change = text Annabel.
              <section className="fulfill" ref={fulfillRef}>
                <div className="eyebrow">fulfillment</div>
                <h2 className="section-title">Going with your order</h2>
                <div className="fulfill-detail">
                  <div className="addr-stack">
                    <div className="label-sm">
                      {existingOrder.fulfillment_type === "pickup"
                        ? "Pickup at the farm"
                        : "Delivery Wednesday"}
                    </div>
                    <div className="addr-text">
                      {existingOrder.fulfillment_type === "pickup"
                        ? existingOrder.pickup_note?.trim() ||
                          "3612 W 114th St, Cleveland"
                        : existingOrder.delivery_address ||
                          existingOrder.delivery_preference?.trim() ||
                          "Wednesday morning, 8am–noon"}
                    </div>
                  </div>
                  <div className="fulfill-help">
                    These items go out with the order you already placed. Need
                    to change this? Text Annabel · 216-202-5718.
                  </div>
                </div>
              </section>
            ) : (
            <section className="fulfill" ref={fulfillRef}>
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
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "pickup"}
                  className={"fulfill-tab" + (mode === "pickup" ? " is-active" : "")}
                  onClick={() => setMode("pickup")}
                >
                  <div className="fulfill-tab-label">Pickup at farm</div>
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
                    value={pickupNote}
                    onChange={(e) => setPickupNote(e.target.value)}
                  />
                  <div className="fulfill-help">
                    Pickup at the farm (3612 W 114th St, Cleveland). Annabel will
                    text you the morning of.
                  </div>
                </div>
              )}
            </section>
            )}

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
                <div className="eyebrow">your order</div>
                {addMode && existingOrder ? (
                  <ExistingItemsGroup items={existingOrder.items} />
                ) : null}
                {addMode && existingOrder && existingOrder.items.length > 0 ? (
                  <div className="rail-adding-head">Adding now</div>
                ) : null}
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
                          ${formatPrice((qty[p.id] ?? 0) * (unitFor(p)?.unit_price_cents ?? 0))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="rail-totals">
                  <div className="rail-row rail-row-total">
                    <span>Total</span>
                    <span className="mono">
                      ${formatPrice(addMode ? grandTotalCents : subtotalCents)}
                    </span>
                  </div>
                </div>
                <div className="summary-sub">
                  {addMode
                    ? existingOrder?.fulfillment_type === "pickup"
                      ? "Adding to your pickup order"
                      : "Adding to your delivery order"
                    : mode === "delivery"
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
                ) : addMode ? (
                  "Update order"
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
              {addMode && existingOrder ? (
                <ExistingItemsGroup items={existingOrder.items} />
              ) : null}
              {addMode && existingOrder && existingOrder.items.length > 0 ? (
                <div className="rail-adding-head">Adding now</div>
              ) : null}
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
                        ${formatPrice((qty[p.id] ?? 0) * (unitFor(p)?.unit_price_cents ?? 0))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="rail-totals">
                <div className="rail-row rail-row-total">
                  <span>Total</span>
                  <span className="mono">
                    ${formatPrice(addMode ? grandTotalCents : subtotalCents)}
                  </span>
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
                ) : addMode ? (
                  "Update order"
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
            {addMode ? "Adding " : ""}
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </div>
          {/* 9.1 — the sticky bar is scoped to the additions (its count is the
              additions count + its button is "Review", not submit), so it keeps
              the additions subtotal. The "Adding" label distinguishes it from
              the summary card's grand total. */}
          <div className="sticky-total mono">${formatPrice(subtotalCents)}</div>
        </div>
        <button
          type="button"
          className="btn btn-primary sticky-btn"
          onClick={scrollToFulfill}
          disabled={submitDisabled}
        >
          Review
        </button>
      </div>
    </div>
  );
}
