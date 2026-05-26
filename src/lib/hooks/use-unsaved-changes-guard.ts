"use client";

import { useEffect } from "react";

const MESSAGE = "You have unsaved changes — leave anyway?";

// Module-level set of events that have already been handled by any
// instance of this hook. Prevents double-prompting when multiple guarded
// forms are dirty simultaneously (e.g. inventory editor + units drawer
// both registered): each listener checks-then-stamps the event so only
// the first one prompts.
const handledEvents = new WeakSet<Event>();

// #129 — prompt before discarding unsaved form edits. Covers three exit
// paths because each one fires a different browser event:
//
//   1. beforeunload — full reload, tab close, navigation to an external
//      URL. Browser shows its own generic prompt; our message is ignored
//      (browsers stripped custom messages years ago).
//   2. click on an <a href> going to a different URL — Next.js <Link>
//      uses history.pushState under the hood, which does NOT fire
//      beforeunload. We intercept at the document level in capture phase
//      so we beat Link's own click handler.
//   3. browser back / forward — fires popstate, also without beforeunload.
//      We seed a duplicate history entry on mount-while-dirty so popstate
//      lands on the same URL; on confirm-cancel we push another duplicate
//      to stay put.
//
// NOT guarded: programmatic `router.push(...)` calls — Next App Router
// gives no hook to intercept those. Today no guarded form does that
// while dirty; a future caller that does would silently bypass the
// prompt. Add an explicit `if (dirty && !confirm(MESSAGE)) return;`
// before the router.push if you hit that case.
//
// Pass `dirty=false` (or unmount the consumer) to disarm. Saving / closing
// the form is responsible for resetting dirty; the hook only listens.
export function useUnsavedChangesGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty || typeof window === "undefined") return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required for Chrome/Edge; the string is ignored by all modern browsers.
      e.returnValue = "";
    };

    const onClickCapture = (e: MouseEvent) => {
      if (handledEvents.has(e)) return;
      // Only left-clicks without modifier keys (modifier-clicks open in a
      // new tab — the original page stays dirty, no prompt needed).
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor) return;
      // target="_blank" opens a new tab — current page stays mounted +
      // dirty, no prompt needed.
      if (anchor.getAttribute("target") === "_blank") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      // Non-http schemes (mailto:, tel:, sms:, etc.) are app hand-offs,
      // not navigations. /admin/send's "Send" buttons use sms: deep links
      // and must not prompt while the intro-note is dirty.
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      // Same-URL clicks (e.g. logo on the current page) aren't navigations.
      if (url.href === window.location.href) return;
      handledEvents.add(e);
      if (!window.confirm(MESSAGE)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    // Seed a duplicate history entry so the next "back" lands on the
    // same URL — gives us a popstate to intercept. We re-use Next's
    // own state object (not a sentinel) because pushing a string state
    // makes the Next App Router fail to render on the next nav: the
    // router calls methods on `history.state` and explodes when it
    // finds a string. Trade-off: we can't sentinel-check, so a re-mount
    // or rapid dirty toggle lays down extra duplicates. The back-stack
    // grows by a few entries per editing session — acceptable for an
    // admin tool.
    //
    // Known cost: we don't pop the seed on cleanup, so after a clean
    // save the user's first browser-back press silently lands on the
    // same URL (the seed), and the second press actually navigates.
    // Popping in cleanup would race with the popstate that triggered
    // the cleanup in the first place; documented as admin tool tax.
    window.history.pushState(window.history.state, "", window.location.href);
    const onPopState = (e: PopStateEvent) => {
      if (handledEvents.has(e)) return;
      handledEvents.add(e);
      if (!window.confirm(MESSAGE)) {
        window.history.pushState(window.history.state, "", window.location.href);
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [dirty]);
}
