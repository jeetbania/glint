"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

/**
 * Mounted once in the (app) layout. Wraps [data-app-main] — the app's
 * own scroll container, see layout.tsx — in a Lenis instance so wheel
 * and trackpad scrolling glides with a bit of eased inertia instead of
 * the raw, un-smoothed native scroll, the way most modern sites feel.
 *
 * Re-created on every route change (keyed off usePathname): main's
 * child is a different DOM node per page (Library vs Tags vs Notes vs a
 * Collection canvas), and this component itself never unmounts across
 * client-side navigation — without tearing down and reconstructing
 * Lenis here, it would keep measuring the PREVIOUS page's now-detached
 * content element after the first navigation.
 *
 * Skipped entirely under prefers-reduced-motion (checked explicitly here
 * since it decides whether to construct the instance at all, not just
 * how it animates).
 *
 * The collection canvas (collection-canvas.tsx) has its own wheel-driven
 * pan/zoom and carries data-lenis-prevent on its root — Lenis's built-in
 * escape hatch (any ancestor of the wheel target with that attribute
 * makes Lenis skip the event entirely, no preventDefault, no scrolling)
 * — so the two don't fight over wheel events on that page.
 */
export function SmoothScrollProvider() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const wrapper = document.querySelector<HTMLElement>("[data-app-main]");
    // Every page under (app)/layout.tsx renders as {children} inside
    // that <main>, and a Next.js page component always returns one root
    // node — so main's one and only child element IS "everything
    // scrollable on this page," exactly what Lenis wants as `content`.
    const content = wrapper?.firstElementChild as HTMLElement | null;
    if (!wrapper || !content) return;

    const lenis = new Lenis({
      wrapper,
      content,
      autoRaf: true,
      // A touch tighter than Lenis' own default (0.1) — this is a dense
      // image grid people scan quickly, not a marketing page; much more
      // float on every scroll tick read as laggy rather than smooth.
      lerp: 0.12,
      wheelMultiplier: 1,
    });

    return () => lenis.destroy();
  }, [pathname]);

  return null;
}
