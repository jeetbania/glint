"use client";

import { useEffect } from "react";
import { isElectron, getElectronPlatform } from "@/lib/is-electron";

/** Marks <html data-desktop-shell="darwin|win32|linux"> when running
 * inside the Electron desktop app so CSS can make the page background
 * transparent (letting the native OS vibrancy applied to the window
 * show through) on any platform, and give the app's own header room
 * for the traffic-light strip above it on macOS specifically — Windows
 * uses Electron's normal framed window (see electron/main.js), which
 * already has its own native minimize/maximize/close controls, so
 * there's nothing to reserve that extra strip for there. The attribute
 * carries the actual platform (not just a bare boolean) so globals.css
 * can key off `[data-desktop-shell="darwin"]` for the mac-only rule
 * while `[data-desktop-shell]` alone still matches for the shared
 * cross-platform ones. A plain DOM attribute set once on mount — not
 * React state — so this intentionally isn't a set-state-in-effect
 * case. */
export function DesktopShellAdjustments() {
  useEffect(() => {
    if (isElectron()) {
      document.documentElement.setAttribute("data-desktop-shell", getElectronPlatform() ?? "");
    }
  }, []);

  return null;
}
