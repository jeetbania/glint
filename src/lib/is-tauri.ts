/** True when the page is running inside the Tauri desktop shell rather
 * than a normal browser tab. Tauri injects this global into every page
 * loaded in its webview regardless of whether the page itself depends on
 * `@tauri-apps/api` — safe to check without adding that package here. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
