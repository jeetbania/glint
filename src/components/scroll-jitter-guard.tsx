"use client";

import { useEffect } from "react";

/** How long after the last scroll event to keep data-scrolling stamped —
 * long enough to bridge the gap between two scroll events during a
 * continuous scroll (trackpad/wheel events fire far more often than
 * this), short enough that hover effects come back within a beat of
 * actually stopping. */
const SCROLL_END_DELAY_MS = 150;

/**
 * Mounted once in the (app) layout. Stamps data-scrolling on
 * [data-app-main] while it's actively scrolling, and clears it
 * SCROLL_END_DELAY_MS after the last scroll event — see globals.css's
 * `[data-app-main][data-scrolling] .item-card` rule, which is the actual
 * fix (this component only maintains the attribute it reads).
 *
 * Listens on the scroll container directly (not window) since
 * [data-app-main] is its own overflow-y-auto pane, not the document —
 * scroll events on an element don't bubble, so `window.addEventListener
 * ("scroll", ...)` would never fire for this at all.
 */
export function ScrollJitterGuard() {
  useEffect(() => {
    const main = document.querySelector<HTMLElement>("[data-app-main]");
    if (!main) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    function onScroll() {
      main!.setAttribute("data-scrolling", "");
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => main!.removeAttribute("data-scrolling"), SCROLL_END_DELAY_MS);
    }

    main.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      main.removeEventListener("scroll", onScroll);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return null;
}
