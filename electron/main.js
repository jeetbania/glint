// Electron main process for the Glint desktop shell. Mirrors what the
// old Tauri shell did (see git history / src-tauri, now removed): a
// thin native window wrapping the SAME hosted app — loading
// https://glint-jeetbania.vercel.app in production and localhost:3000
// in dev — not a bundled local copy of the Next.js build. That's why
// electron-builder only needs to package this directory plus icons, not
// the whole app.
const { app, BrowserWindow, clipboard, nativeTheme } = require("electron");
const path = require("node:path");
const crypto = require("node:crypto");

const PROD_URL = "https://glint-jeetbania.vercel.app";
const DEV_URL = "http://localhost:3000";
// Lets the desktop app skip the password screen automatically — see
// src/proxy.ts's matching check. Only ever sent on this one initial
// load; every navigation after that relies on the session cookie the
// server sets in response to it, not this constant being resent.
const DESKTOP_APP_SECRET = "e4911bcd2c8094c66d8c36d5ac58ae864b25df8549aabc91";

// macOS traffic-light position, centered inside the dedicated 24px
// (1.5rem) titlebar strip reserved for them — see globals.css's
// [data-titlebar-strip="darwin"] rule.
const TRAFFIC_LIGHT_POSITION = { x: 12, y: 6 };
const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

// Matches globals.css's --background token (light #ffffff / dark
// #08080a). Used as the real, opaque native backgroundColor on
// Windows/Linux — NOT `transparent: true` there, unlike macOS. macOS's
// `vibrancy` option has been reliably supported for years, but
// Windows' equivalent (`backgroundMaterial: "mica"`) only works on
// Windows 11 build 22621+, and Linux has no native vibrancy at all in
// Electron; a `transparent: true` window with nothing actually
// compositing behind it renders as a broken, see-through void rather
// than degrading gracefully. A plain solid color matching the app's
// own theme is the correct universal fallback — backgroundMaterial
// still upgrades it to real Mica wherever the OS supports it, but the
// window looks right either way instead of gambling on OS version.
function nativeBackgroundColor() {
  return nativeTheme.shouldUseDarkColors ? "#08080a" : "#ffffff";
}

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
    // (Mail, Notes) use. `vibrancy` is the direct Electron equivalent
    // of what the old Tauri shell needed the window-vibrancy crate +
    // macOS-private-API entitlement for — no private API here, this is
    // a fully public, documented option. Windows/Linux get a solid,
    // theme-matched backgroundColor instead (see nativeBackgroundColor
    // above) — backgroundMaterial: "mica" then upgrades that to real
    // vibrancy on Windows 11 builds that support it, without ever
    // risking a transparent window with nothing behind it.
    ...(isMac
      ? {
          transparent: true,
          backgroundColor: "#00000000",
          vibrancy: "sidebar",
          visualEffectState: "active",
        }
      : {
          backgroundColor: nativeBackgroundColor(),
          ...(isWindows ? { backgroundMaterial: "mica" } : {}),
        }),
    // titleBarStyle: "hidden" is macOS-only here on purpose. On
    // Windows/Linux, "hidden" DOES take effect (unlike what an earlier
    // comment here assumed) — it removes the native frame, but without
    // a titleBarOverlay to draw replacement minimize/maximize/close
    // buttons, the window ends up with no window controls at all, only
    // closable via Alt+F4. Rather than hand-tune a custom overlay (drawn
    // controls, colors, hit-testing) with no real Windows machine to
    // verify it on, Windows/Linux just get Electron's normal framed
    // window — guaranteed-correct native controls, at the cost of the
    // custom-traffic-light polish, which was never a Windows convention
    // to begin with anyway.
    ...(isMac
      ? { titleBarStyle: "hidden", trafficLightPosition: TRAFFIC_LIGHT_POSITION }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const baseUrl = app.isPackaged ? PROD_URL : DEV_URL;
  win.loadURL(`${baseUrl}/?desktop_key=${DESKTOP_APP_SECRET}`);
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
