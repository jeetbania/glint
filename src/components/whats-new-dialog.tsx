"use client";

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_VERSION, CHANGELOG } from "@/lib/version";

const LAST_SEEN_KEY = "glint:last-seen-version";

/** Mounted once in the (app) layout. Compares APP_VERSION against
 * whatever version this browser last saw (localStorage, per-device like
 * every other local-first preference here) and, if it's genuinely newer
 * (an upgrade, not a brand-new install — see below), pops open a dialog
 * listing everything that shipped since. Always stamps the current
 * version as "seen" after checking, whether or not the dialog opened.
 *
 * A missing stored version means this device has never opened Glint
 * before, not that every past release is "new" to it — showing the
 * entire changelog history to a first-time visitor would be noise, not
 * news, so that case just silently records the current version and
 * moves on. */
/** Reads localStorage and decides both "should the dialog start open"
 * and "which entries to show" in one lazy useState initializer (runs
 * synchronously during the first render, like useLocalStorage's own
 * lazy-init) — deliberately NOT an effect that calls setState after
 * mount, since that would be a synchronous external-read driving a
 * state update for no reason other than "couldn't read localStorage
 * during render," which isn't true here (this only ever runs client-side,
 * mounted well after hydration — see the (app) layout). */
function computeInitialState(): { open: boolean; entries: typeof CHANGELOG } {
  if (typeof window === "undefined") return { open: false, entries: [] };
  let lastSeen: string | null = null;
  try {
    lastSeen = window.localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    // Storage unavailable — treat like a first-ever visit, below.
  }
  if (lastSeen && lastSeen !== APP_VERSION) {
    const idx = CHANGELOG.findIndex((e) => e.version === lastSeen);
    // If the stored version isn't found in CHANGELOG at all (an old
    // build from before this system existed, or one that got pruned),
    // fall back to just the latest entry rather than the whole list.
    const unseen = idx === -1 ? CHANGELOG.slice(0, 1) : CHANGELOG.slice(0, idx);
    if (unseen.length > 0) return { open: true, entries: unseen };
  }
  return { open: false, entries: [] };
}

export function WhatsNewDialog() {
  const [{ open: initialOpen, entries: entriesToShow }] = useState(computeInitialState);
  const [open, setOpen] = useState(initialOpen);

  // Stamping "seen" is a genuine external-system write (localStorage),
  // not a state update — a plain effect is the right place for it,
  // unlike the read+decision above.
  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_SEEN_KEY, APP_VERSION);
    } catch {
      // Nothing to fall back to for a plain string this small — worst
      // case it just asks again next launch.
    }
  }, []);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-[80] w-full max-w-md -translate-x-1/2 -translate-y-1/2 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <div className="glass-panel max-h-[32rem] overflow-hidden rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <DialogPrimitive.Title className="font-heading text-lg font-semibold tracking-heading">
                  What&rsquo;s new
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close render={<Button variant="outline" size="icon-sm" />}>
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>

            <div className="max-h-[22rem] space-y-5 overflow-y-auto pr-1">
              {entriesToShow.map((entry) => (
                <div key={entry.version}>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Version {entry.version} — {entry.date}
                  </p>
                  <ul className="space-y-1.5">
                    {entry.highlights.map((h, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-snug">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground/40" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <DialogPrimitive.Close render={<Button size="sm" className="mt-5 w-full" />}>
              Got it
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
