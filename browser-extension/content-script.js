// Runs only on the Glint app itself (see manifest.json's content_scripts
// match pattern — not injected anywhere else). Bridges messages from the
// background service worker into real DOM events: content scripts run
// in an isolated JS world and can't call the page's own functions
// directly, but window.dispatchEvent crosses that boundary fine since
// it's just a DOM event, not a JS reference. The page's
// ExtensionSyncProvider (src/components/extension-sync-provider.tsx) is
// the other half of this — it does the actual local save.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "glint-extension-save") {
    window.dispatchEvent(
      new CustomEvent("glint-extension-save", { detail: message.payload }),
    );
  }
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
