/** True when the page is running inside the Electron desktop shell
 * rather than a normal browser tab. Backed by an explicit `window.glint
 * .isElectron` flag set by electron/preload.js via contextBridge —
 * deliberate rather than incidental (the old Tauri build's equivalent
 * relied on a global Tauri happened to inject automatically), but same
 * zero-dependency shape so call sites didn't need to change. */
export function isElectron(): boolean {
  return typeof window !== "undefined" && !!(window as { glint?: { isElectron?: boolean } }).glint?.isElectron;
}
