"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const START_TOUR_EVENT = "glint:start-tour";
const TOUR_SEEN_KEY = "glint:tour-seen";

type Step = {
  /** CSS selector for the element to spotlight — omit for the welcome
   * step, which is just a centered card with no target. */
  target?: string;
  /** Only steps without `route` run wherever the tour happens to be
   * started; steps that need a specific page (the collections step
   * only exists on /library) navigate there first. */
  route?: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    title: "Welcome to Glint",
    body: "A personal space for the images, links, notes, and tasks you don't want to lose. Here's a 60-second look at what you can do.",
  },
  {
    target: '[role="tablist"]',
    route: "/library",
    title: "Library, Notes, and Tasks",
    body: "Three views into everything you've saved. Images and links live in Library; notes and tasks get their own dedicated views.",
  },
  {
    target: '[data-tour="search"]',
    title: "Search everything, instantly",
    body: "Press ⌘K (or Ctrl+K) from anywhere, or click here, to jump straight to any item, folder, or note.",
  },
  {
    target: '[data-tour="collections"]',
    route: "/library",
    title: "Folders with their own color",
    body: "Group things into a collection, give it a color, and see what's inside it before you even open it up.",
  },
  {
    target: '[aria-label="Toggle theme"]',
    title: "Light or dark, your call",
    body: "Glint's glass look adapts to either — switch anytime, it remembers your choice.",
  },
  {
    target: '[aria-label="Settings"]',
    title: "That's the tour",
    body: "Tags, your account, and app settings live here. Go ahead and paste something in to get started.",
  },
];

const SPOTLIGHT_PADDING = 8;

function useTargetRect(selector: string | undefined, step: number, pathname: string) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selector) return;
    let cancelled = false;

    function measure() {
      const el = document.querySelector(selector!);
      if (!el || cancelled) return;
      setRect(el.getBoundingClientRect());
    }

    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // Scroll takes a beat to settle before the rect is meaningful —
    // matches the smooth-scroll duration rather than guessing zero.
    const timer = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
    // `pathname` is a dependency on purpose, not just `step`/`selector`:
    // a step that first navigates to a new route (goToStep's
    // router.push) changes `step` immediately, before that navigation
    // has actually finished rendering the target page — the first
    // measure attempt can race it and find nothing. Re-running this
    // effect again once `pathname` itself updates re-measures against
    // the page that's actually on screen, self-correcting shortly
    // after instead of staying stuck on a missed measurement.
  }, [selector, step, pathname]);

  // Derived at return time rather than cleared via setState inside the
  // effect above — same result (no target selector means no spotlight),
  // without an extra synchronous setState-in-effect call.
  return selector ? rect : null;
}

/** A guided in-app walkthrough — dims the app behind a spotlight cutout
 * (a box-shadow trick: a transparent box the size of the target element
 * with a huge shadow covering everything else, rather than an SVG/canvas
 * mask) and steps through STEPS with Next/Back/Skip. Runs entirely in
 * the web app, so it's identical in the browser and both desktop
 * builds — Electron just loads this same hosted page, there's no
 * separate Mac/Windows implementation needed.
 *
 * Auto-starts once for first-time visitors (a `glint:tour-seen`
 * localStorage flag, set the moment it starts so a mid-tour refresh
 * doesn't re-trigger it) and can be replayed anytime via the command
 * palette's "Take a tour" command, which dispatches START_TOUR_EVENT. */
export function ProductTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  const current = STEPS[step];
  const rect = useTargetRect(active ? current?.target : undefined, step, pathname);

  const goToStep = useCallback(
    (index: number) => {
      const target = STEPS[index];
      if (target?.route && pathname !== target.route) {
        router.push(target.route);
      }
      setStep(index);
    },
    [pathname, router],
  );

  const start = useCallback(() => {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
    setActive(true);
    goToStep(0);
  }, [goToStep]);

  const stop = useCallback(() => setActive(false), []);

  // Manual replay trigger (command palette).
  useEffect(() => {
    window.addEventListener(START_TOUR_EVENT, start);
    return () => window.removeEventListener(START_TOUR_EVENT, start);
  }, [start]);

  // First-visit auto-start — waits for the shell to settle so the
  // spotlight isn't measuring elements mid-layout.
  useEffect(() => {
    if (localStorage.getItem(TOUR_SEEN_KEY)) return;
    const timer = setTimeout(start, 900);
    return () => clearTimeout(timer);
    // Only ever the very first mount of the app shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {active && (
        <div className="fixed inset-0 z-[200]" role="dialog" aria-modal aria-label="Product tour">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/55"
            onClick={stop}
          />

          {rect && (
            <motion.div
              layout
              initial={false}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="pointer-events-none fixed rounded-2xl"
              style={{
                top: rect.top - SPOTLIGHT_PADDING,
                left: rect.left - SPOTLIGHT_PADDING,
                width: rect.width + SPOTLIGHT_PADDING * 2,
                height: rect.height + SPOTLIGHT_PADDING * 2,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              }}
            />
          )}

          <TourCard
            key={step}
            rect={rect}
            title={current.title}
            body={current.body}
            step={step}
            total={STEPS.length}
            isLast={isLast}
            onBack={step > 0 ? () => goToStep(step - 1) : undefined}
            onNext={() => (isLast ? stop() : goToStep(step + 1))}
            onSkip={stop}
          />
        </div>
      )}
    </AnimatePresence>
  );
}

function TourCard({
  rect,
  title,
  body,
  step,
  total,
  isLast,
  onBack,
  onNext,
  onSkip,
}: {
  rect: DOMRect | null;
  title: string;
  body: string;
  step: number;
  total: number;
  isLast: boolean;
  onBack?: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  // No target (the welcome step) centers the card; otherwise place it
  // below the spotlight, flipping above when there isn't room, and
  // clamp horizontally so it never runs off a narrow viewport.
  const cardWidth = 340;
  const margin = 16;
  let style: React.CSSProperties = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  };

  if (rect && typeof window !== "undefined") {
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeBelow = spaceBelow > 200 || spaceBelow > rect.top;
    const top = placeBelow ? rect.bottom + SPOTLIGHT_PADDING + 12 : undefined;
    const bottom = !placeBelow ? window.innerHeight - rect.top + SPOTLIGHT_PADDING + 12 : undefined;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - cardWidth / 2, margin),
      window.innerWidth - cardWidth - margin,
    );
    style = { position: "fixed", top, bottom, left, transform: "none" };
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      style={{ ...style, width: cardWidth }}
      className="glass-panel rounded-2xl p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">
          {step + 1} of {total}
        </span>
        <button
          type="button"
          aria-label="Close tour"
          onClick={onSkip}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <h2 className="mt-2 font-heading text-lg font-semibold tracking-heading">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className={cn("mt-4 flex items-center gap-2", onBack ? "justify-between" : "justify-end")}>
        {onBack && (
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            Back
          </Button>
        )}
        <div className="flex items-center gap-2">
          {!isLast && (
            <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
              Skip
            </Button>
          )}
          <Button type="button" size="sm" onClick={onNext}>
            {isLast ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
