// Electron main process for the Glint desktop shell. Mirrors what the
// old Tauri shell did (see git history / src-tauri, now removed): a
// thin native window wrapping the SAME hosted app — loading
// https://glint-jeetbania.vercel.app in production and localhost:3000
// in dev — not a bundled local copy of the Next.js build. That's why
// electron-builder only needs to package this directory plus icons, not
// the whole app.
const { app, BrowserWindow, clipboard } = require("electron");
const path = require("node:path");
const crypto = require("node:crypto");

const PROD_URL = "https://glint-jeetbania.vercel.app";
const DEV_URL = "http://localhost:3000";

// macOS traffic-light position, centered inside the dedicated 24px
// (1.5rem) titlebar strip reserved for them — see globals.css's
// [data-titlebar-strip] rule. Ignored on Windows/Linux (no custom
// traffic lights there; Electron draws its own standard frame).
const TRAFFIC_LIGHT_POSITION = { x: 12, y: 6 };

function createWindow() {
  const win = new BrowserWindow({
    title: "Glint",
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    resizable: true,
    fullscreen: false,
    // Transparent + real OS vibrancy (not a CSS approximation) — the
    // window itself carries the material; the app's own glass panels
    // layer their own blur on top, same combination native macOS apps
    // (Mail, Notes) use. `vibrancy`/`backgroundMaterial` are the direct
    // Electron equivalents of what the old Tauri shell needed the
    // window-vibrancy crate + macOS-private-API entitlement for — no
    // private API here, this is a fully public, documented option.
    transparent: true,
    backgroundColor: "#00000000",
    vibrancy: "sidebar", // macOS
    visualEffectState: "active",
    backgroundMaterial: "mica", // Windows 11 — no-ops elsewhere
    titleBarStyle: "hidden",
    trafficLightPosition: TRAFFIC_LIGHT_POSITION,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(app.isPackaged ? PROD_URL : DEV_URL);
  return win;
}

// ---------------------------------------------------------------------
// Clipboard watch — offers to save a new screenshot/link/text even when
// the app isn't focused. The old Tauri version hand-wrote this against
// raw AppKit (NSPasteboard) because macOS's private API was already a
// dependency for vibrancy; Electron's built-in `clipboard` module needs
// none of that AND works cross-platform (Windows/Linux too, not just
// macOS) — a genuine capability upgrade, not just a port. Electron has
// no NSPasteboard-style "changeCount" to cheaply detect a real change,
// so a content hash stands in for it.
// ---------------------------------------------------------------------
const CLIPBOARD_POLL_MS = 900;
let lastClipboardSignature = null;

function readClipboardCapture() {
  const image = clipboard.readImage();
  if (!image.isEmpty()) {
    const png = image.toPNG();
    return {
      signature: `image:${crypto.createHash("sha1").update(png).digest("hex")}`,
      payload: { kind: "image", data: png.toString("base64") },
    };
  }
  const text = clipboard.readText().trim();
  if (text) {
    return {
      signature: `text:${crypto.createHash("sha1").update(text).digest("hex")}`,
      payload: { kind: "text", data: text },
    };
  }
  return null;
}

function startClipboardWatch(win) {
  setInterval(() => {
    const capture = readClipboardCapture();
    if (!capture || capture.signature === lastClipboardSignature) return;
    lastClipboardSignature = capture.signature;
    if (!win.isDestroyed()) win.webContents.send("clipboard-changed", capture.payload);
  }, CLIPBOARD_POLL_MS);
}

app.whenReady().then(() => {
  app.setName("Glint");
  const win = createWindow();
  startClipboardWatch(win);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
