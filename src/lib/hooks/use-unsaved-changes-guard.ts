"use client";

import { useEffect } from "react";

const MESSAGE = "You have unsaved changes — leave anyway?";

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
      // Only left-clicks without modifier keys (modifier-clicks open in a
      // new tab — the original page stays dirty, no prompt needed).
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // Same-URL clicks (e.g. logo on the current page) aren't navigations.
      if (url.href === window.location.href) return;
      if (!window.confirm(MESSAGE)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    // Seed a duplicate history entry so the next "back" lands on the same
    // URL we're already on — gives us a popstate to intercept. Pushing on
    // each dirty→true transition is acceptable for an admin tool; the
    // back stack may carry a few extra entries per editing session.
    window.history.pushState(null, "", window.location.href);
    const onPopState = () => {
      if (!window.confirm(MESSAGE)) {
        window.history.pushState(null, "", window.location.href);
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
