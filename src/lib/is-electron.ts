/** True when the page is running inside the Electron desktop shell
 * rather than a normal browser tab. Backed by an explicit `window.glint
 * .isElectron` flag set by electron/preload.js via contextBridge —
 * deliberate rather than incidental (the old Tauri build's equivalent
 * relied on a global Tauri happened to inject automatically), but same
 * zero-dependency shape so call sites didn't need to change. */
export function isElectron(): boolean {
  return typeof window !== "undefined" && !!(window as { glint?: { isElectron?: boolean } }).glint?.isElectron;
}

/** "darwin" | "win32" | "linux" | undefined (browser tab, no desktop
 * shell). Backed by `window.glint.platform`, set from Node's own
 * `process.platform` in electron/preload.js — used to tell macOS's
 * custom hidden-titlebar window apart from Windows/Linux's normal
 * framed one, since only macOS reserves a traffic-light strip. */
export function getElectronPlatform(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as { glint?: { platform?: string } }).glint?.platform;
}
