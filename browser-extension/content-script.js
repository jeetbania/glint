// Runs on the WHOLE Glint origin (see manifest.json's content_scripts
// match pattern: "https://glint-jeetbania.vercel.app/*") — that includes
// /login and /landingpage, not just the authenticated app shell. But
// ExtensionSyncProvider (src/components/extension-sync-provider.tsx),
// the thing that actually performs the local save, is only mounted
// inside the (app) layout. So a tab sitting on /login (no session yet)
// or /landingpage still receives and "delivers" a message just fine —
// there's just nobody in the page listening for it.
//
// Bridges messages from the background service worker into real DOM
// events: content scripts run in an isolated JS world and can't call the
// page's own functions directly, but window.dispatchEvent crosses that
// boundary fine since it's just a DOM event, not a JS reference. To know
// whether the save actually landed (not just that SOME page happened to
// be open), every dispatch carries a unique id and waits for a matching
// "glint-extension-save-result" event the page dispatches back once it's
// actually handled — see extension-sync-provider.tsx. If nothing acks in
// time, sendResponse(false) tells background.js's deliver()/drainQueue()
// the save did NOT land, so it falls back to (or stays in) the queue
// instead of believing a save that silently went nowhere.
const ACK_TIMEOUT_MS = 4000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "glint-extension-save") return undefined;

  const id = `glint-save-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let settled = false;

  function onResult(event) {
    if (event.detail?.id !== id) return;
    finish(!!event.detail.success);
  }
  function finish(success) {
    if (settled) return;
    settled = true;
    window.removeEventListener("glint-extension-save-result", onResult);
    sendResponse(success);
  }

  window.addEventListener("glint-extension-save-result", onResult);
  setTimeout(() => finish(false), ACK_TIMEOUT_MS);
  window.dispatchEvent(new CustomEvent("glint-extension-save", { detail: { id, payload: message.payload } }));

  return true; // keep the message channel open for the async sendResponse above
});

// Saves made while no Glint tab was open get queued by the background
// worker (chrome.storage.local, extension-scoped — not the page's own
// storage) instead of dropped. Ask for that backlog once this content
// script is actually alive to receive it, and again as a race-safety
// net a moment later in case the very first ask landed before the
// background worker had finished waking up.
function drainQueue() {
  chrome.runtime.sendMessage({ type: "glint-drain-queue" }).catch(() => {
    // Background worker not ready yet — the retry below covers it.
  });
}
drainQueue();
setTimeout(drainQueue, 1500);
