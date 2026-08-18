// Glint — save-to-library browser extension. Manual save only (toolbar
// click + right-click context menus), no background scraping/auto-sync —
// see the chat history for why: reliability over the more fragile
// "watch X/Instagram saved pages" approach.
//
// host_permissions in manifest.json covers the CORS story: fetch() calls
// made from this privileged extension context to a host listed there
// bypass normal cross-origin restrictions, so no server-side CORS
// headers were needed for this to work against the live API.

const API_BASE = "https://glint-jeetbania.vercel.app";

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

async function saveLink(url, title) {
  const res = await fetch(`${API_BASE}/api/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "link", url, title: title || undefined }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Save failed (${res.status})`);
  }
}

async function saveImage(imageUrl, pageUrl, pageTitle) {
  const res = await fetch(`${API_BASE}/api/extension/save-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl, pageUrl, pageTitle: pageTitle || undefined }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Save failed (${res.status})`);
  }
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
      await saveImage(info.srcUrl, info.pageUrl, tab?.title);
      notify("Image saved to Glint", tab?.title || "");
    } else if (info.menuItemId === "glint-save-link") {
      await saveLink(info.linkUrl);
      notify("Link saved to Glint", info.linkUrl);
    }
  } catch (err) {
    notify("Couldn't save to Glint", String(err.message || err));
  }
});
