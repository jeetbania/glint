"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// The sliding-pill segmented control (t-tabs-dev's "16-tabs-sliding"
// transition, ported to React refs instead of raw DOM query wiring) —
// one component so every tab-like control in the app (top nav, Library
// type filters, the collection canvas's filter pills) shares the exact
// same look and motion instead of three different hand-rolled styles.
// Items can carry an `href` for real navigation (top nav) instead of
// `onChange` for in-place client state (filter pills) — either way the
// pill just watches `value` and slides to whichever tab matches it.
export type TabItem = { value: string; label: React.ReactNode; href?: string };

export function Tabs({
  items,
  value,
  onChange,
  className,
  glass = true,
}: {
  items: TabItem[];
  value: string;
  onChange?: (value: string) => void;
  className?: string;
  /** Set false for tabs sitting inside an already-glass ancestor (e.g.
   * a dialog header), where a second blur layer would look muddy. */
  glass?: boolean;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<Record<string, HTMLElement | null>>({});

  function movePill(animate: boolean) {
    const pill = pillRef.current;
    const tab = tabRefs.current[value];
    if (!pill || !tab) return;
    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.transform = `translateX(${tab.offsetLeft}px)`;
      pill.style.width = `${tab.offsetWidth}px`;
      void pill.offsetWidth; // force reflow so the transition-none actually applies before restoring
      pill.style.transition = prev;
    } else {
      pill.style.transform = `translateX(${tab.offsetLeft}px)`;
      pill.style.width = `${tab.offsetWidth}px`;
    }
  }

  // Snap into place on mount and on resize (column width, sidebar
  // collapse, etc.) — never animate for these, only for an actual click,
  // otherwise the pill visibly flies in from translateX(0)/width:0 on
  // every page load.
  useLayoutEffect(() => {
    movePill(false);
    const ro = new ResizeObserver(() => movePill(false));
    if (barRef.current) ro.observe(barRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- movePill closes over refs only, re-running per items/value below is what we want
  }, [items.length]);

  useLayoutEffect(() => {
    movePill(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div
      ref={barRef}
      role="tablist"
      className={cn(
        "t-tabs relative inline-flex items-center gap-0.5 rounded-full p-[3px]",
        glass && "glass-pill",
        className,
      )}
    >
      <span
        ref={pillRef}
        aria-hidden
        className="absolute left-0 top-[3px] z-0 h-[calc(100%-6px)] w-0 rounded-full bg-foreground will-change-[transform,width]"
        style={{ transition: "transform 250ms cubic-bezier(0.22,1,0.36,1), width 250ms cubic-bezier(0.22,1,0.36,1)" }}
      />
      {items.map((item) => {
        const selected = value === item.value;
        const tabClassName = cn(
          "relative z-10 flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
          selected ? "text-background" : "text-muted-foreground hover:text-foreground",
        );
        const refCallback = (el: HTMLElement | null) => {
          tabRefs.current[item.value] = el;
        };
        if (item.href) {
          return (
            <Link
              key={item.value}
              href={item.href}
              ref={refCallback}
              role="tab"
              aria-selected={selected}
              className={tabClassName}
            >
              {item.label}
            </Link>
          );
        }
        return (
          <button
            key={item.value}
            ref={refCallback}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => {
              if (!selected) onChange?.(item.value);
            }}
            className={tabClassName}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
