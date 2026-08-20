// Runs in an isolated world with access to Node + Electron APIs, but the
// renderer (the actual Next.js app) only ever sees whatever's explicitly
// exposed here via contextBridge — contextIsolation is on, nodeIntegration
// is off (electron/main.js), so this is the only door between the two.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("glint", {
  // Cheap, synchronous "am I running inside the desktop app" flag — the
  // renderer-side equivalent of the old Tauri build's automatically
  // injected `__TAURI_INTERNALS__` global, just explicit instead of
  // incidental. See src/lib/is-electron.ts.
  isElectron: true,

  // "darwin" | "win32" | "linux" — lets the renderer tell macOS's
  // custom hidden-titlebar/traffic-light window apart from Windows'
  // normal framed one (electron/main.js only applies the hidden
  // titlebar on darwin; see the platform check there), so CSS doesn't
  // reserve a traffic-light strip that has nothing to reserve space
  // for on Windows. See desktop-shell-adjustments.tsx.
  platform: process.platform,

  /** Subscribes to clipboard-watch captures relayed from the main
   * process (electron/main.js's clipboard poller). Returns an unlisten
   * function, matching the shape @tauri-apps/api/event's `listen()`
   * used to return — kept the same on purpose so the calling React
   * component (clipboard-watch-provider.tsx) didn't need its own
   * cleanup logic rewritten, just the import swapped. */
  onClipboardChanged(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("clipboard-changed", listener);
    return () => ipcRenderer.removeListener("clipboard-changed", listener);
  },
});
