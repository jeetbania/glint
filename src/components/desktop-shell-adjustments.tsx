"use client";

import { useEffect } from "react";
import { isElectron } from "@/lib/is-electron";

/** Marks <html data-desktop-shell> when running inside the Electron
 * desktop app so CSS can make the page background transparent (letting
 * the native OS vibrancy applied to the window show through) and give
 * the app's own header room for the traffic-light strip above it. A
 * plain DOM attribute set once on mount — not React state — so this
 * intentionally isn't a set-state-in-effect case. */
export function DesktopShellAdjustments() {
  useEffect(() => {
    if (isElectron()) {
      document.documentElement.setAttribute("data-desktop-shell", "");
    }
  }, []);

  return null;
}
