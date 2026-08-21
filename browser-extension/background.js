// Glint — save-to-library browser extension. Manual save only (toolbar
// click + right-click context menus), no background scraping/auto-sync —
// see the chat history for why: reliability over the more fragile
// "watch X/Instagram saved pages" approach.
//
// Saved items now live only in the browser's own IndexedDB (see
// src/lib/local/*), not a server database — this worker never sends
// anything to Glint's API. It resizes/reads images itself
// (OffscreenCanvas, available in MV3 service workers) and hands the
// result to whichever Glint tab is open via content-script.js, which
// relays it into the page as a DOM event the page's own
// ExtensionSyncProvider does the actual local save from. If no tab is
// open, the save is queued in this extension's OWN storage
// (chrome.storage.local — never the page's storage) until one opens and
// asks for its backlog.
//
// host_permissions is "<all_urls>" (not just the Glint origin) because
// saving an image means this worker has to fetch the image bytes
// itself, from whatever third-party site the user right-clicked on —
// there's no server left to do that fetch on its behalf. Some
// hotlink-protected images may still fail (a real fetch() can't spoof
// the Referer header the way the old server-side fetch could) — a
// known, acceptable trade-off for not routing image bytes through a
// server at all anymore.

const GLINT_ORIGIN = "https://glint-jeetbania.vercel.app";
const QUEUE_KEY = "glint-save-queue";
const MAX_DIMENSION = 1600;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "glint-save-page",
    title: "Save page to Glint",
    contexts: ["page"],
  });
  chrome.contextMenus.create({
    id: "glint-save-image",
    title: "Save image to Glint",
    contexts: ["image"],
  });
  chrome.contextMenus.create({
    id: "glint-save-link",
    title: "Save link to Glint",
    contexts: ["link"],
  });
});

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message: message || "",
  });
}

async function findOpenTabs() {
  try {
    return await chrome.tabs.query({ url: `${GLINT_ORIGIN}/*` });
  } catch {
    return [];
  }
}

// chrome.storage.local only round-trips JSON-safe values, so an
// ArrayBuffer (image bytes) gets base64-encoded for the trip through
// the queue — only the rare "no tab open" path pays this cost.
function bufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function queueSave(payload) {
  const queuable =
    payload.kind === "image" ? { ...payload, bytes: bufferToBase64(payload.bytes) } : payload;
  const { [QUEUE_KEY]: existing = [] } = await chrome.storage.local.get(QUEUE_KEY);
  await chrome.storage.local.set({ [QUEUE_KEY]: [...existing, queuable] });
}

// Delivers to every open Glint tab if there is one; otherwise queues for
// the next one that opens. "Open Glint tab" per findOpenTabs() means
// any tab under the Glint origin — that includes /login and
// /landingpage, neither of which has a listener actually mounted (see
// content-script.js's big comment) — so success here means a REAL ack
// came back from the page, not just that chrome.tabs.sendMessage didn't
// throw. Only falls back to the queue if EVERY open tab failed to
// confirm it, never per-tab, so 2 tabs open with 1 real app tab among
// them doesn't also queue a duplicate.
async function deliver(payload) {
  const tabs = await findOpenTabs();
  if (tabs.length === 0) {
    await queueSave(payload);
    return;
  }
  const results = await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id === undefined) return false;
      try {
        const ok = await chrome.tabs.sendMessage(tab.id, { type: "glint-extension-save", payload });
        return !!ok;
      } catch {
        return false;
      }
    }),
  );
  if (!results.some(Boolean)) {
    await queueSave(payload);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "glint-drain-queue") return undefined;
  (async () => {
    const { [QUEUE_KEY]: queued = [] } = await chrome.storage.local.get(QUEUE_KEY);
    if (queued.length === 0) return;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    // Deliberately do NOT clear the queue up front — the tab asking to
    // drain it might itself be sitting on /login or /landingpage (the
    // content script is injected across the whole origin; see its
    // comment), which would ack nothing and, if the queue were cleared
    // optimistically first, silently lose every pending item for good.
    // Only items that get a real ack are dropped; everything else stays
    // queued for the next attempt.
    const stillQueued = [];
    for (const payload of queued) {
      const restored =
        payload.kind === "image" ? { ...payload, bytes: base64ToBuffer(payload.bytes) } : payload;
      try {
        const ok = await chrome.tabs.sendMessage(tabId, { type: "glint-extension-save", payload: restored });
        if (!ok) stillQueued.push(payload);
      } catch {
        stillQueued.push(payload);
      }
    }
    await chrome.storage.local.set({ [QUEUE_KEY]: stillQueued });
  })();
  sendResponse?.(true);
  return true;
});

async function saveLink(url, title) {
  await deliver({ kind: "link", url, title: title || undefined });
}

// Fetches the image itself (no more server round trip), downsizes it if
// it's larger than MAX_DIMENSION on its long edge, and re-encodes to
// webp — the same treatment the old server-side sharp step gave it,
// done here instead with OffscreenCanvas so the bytes never leave the
// user's own machine on their way in.
async function saveImage(imageUrl, pageTitle) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Couldn't download that image (${res.status})`);
  const sourceBlob = await res.blob();

  const bitmap = await createImageBitmap(sourceBlob);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  // GIFs kept as their original bytes (matches the old server-side
  // behavior) — canvas re-encoding would flatten them to a single frame.
  const isGif = sourceBlob.type === "image/gif";
  const outBlob = isGif ? sourceBlob : await canvas.convertToBlob({ type: "image/webp", quality: 0.82 });
  const bytes = await outBlob.arrayBuffer();

  await deliver({
    kind: "image",
    title: pageTitle || undefined,
    mimeType: outBlob.type,
    bytes,
    fileName: imageUrl.split("/").pop()?.split("?")[0] || "image",
  });
}

// Toolbar icon click — quick one-click save of the current tab as a link.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url) return;
  try {
    await saveLink(tab.url, tab.title);
    notify("Saved to Glint", tab.title || tab.url);
  } catch (err) {
    notify("Couldn't save to Glint", String(err.message || err));
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === "glint-save-page") {
      await saveLink(info.pageUrl || tab?.url, tab?.title);
      notify("Saved to Glint", tab?.title || info.pageUrl || "");
    } else if (info.menuItemId === "glint-save-image") {
      await saveImage(info.srcUrl, tab?.title);
      notify("Image saved to Glint", tab?.title || "");
    } else if (info.menuItemId === "glint-save-link") {
      await saveLink(info.linkUrl);
      notify("Link saved to Glint", info.linkUrl);
    }
  } catch (err) {
    notify("Couldn't save to Glint", String(err.message || err));
  }
});
