// Runs only on the Glint app itself (see manifest.json's content_scripts
// match pattern — not injected anywhere else). Bridges a message from
// the background service worker into a real DOM event: content scripts
// run in an isolated JS world and can't call the page's own functions
// directly, but window.dispatchEvent crosses that boundary fine since
// it's just a DOM event, not a JS reference.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "glint-item-saved") {
    window.dispatchEvent(new CustomEvent("glint-item-saved"));
  }
});
