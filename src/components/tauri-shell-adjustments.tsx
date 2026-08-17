"use client";

import { useEffect } from "react";
import { isTauri } from "@/lib/is-tauri";

/** Marks <html data-tauri-shell> when running inside the Tauri desktop
 * app so CSS can make the page background transparent (letting the
 * native OS vibrancy applied to the window show through) and give the
 * in-app header room for macOS's overlaid traffic-light buttons. A
 * plain DOM attribute set once on mount — not React state — so this
 * intentionally isn't a set-state-in-effect case. */
export function TauriShellAdjustments() {
  useEffect(() => {
    if (isTauri()) {
      document.documentElement.setAttribute("data-tauri-shell", "");
    }
  }, []);

  return null;
}
