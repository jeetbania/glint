"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";

/**
 * Mounted once in the (app) layout. The browser extension's
 * content-script.js relays a message from its background worker into a
 * `glint-item-saved` DOM CustomEvent on this page — that's the only
 * channel available, since a content script runs in an isolated JS
 * world and can't call this app's own functions directly. Revalidating
 * every /api/items key on that event gets a page you already have open
 * to reflect an extension save within a couple hundred ms, instead of
 * waiting on the Library grid's own 30s fallback poll (which stays in
 * place for contexts this can't reach at all — the Tauri desktop app
 * isn't a Chrome tab, a different device, etc.).
 */
export function ExtensionSyncProvider() {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    function onItemSaved() {
      void mutate((key) => typeof key === "string" && key.startsWith("/api/items"));
    }
    window.addEventListener("glint-item-saved", onItemSaved);
    return () => window.removeEventListener("glint-item-saved", onItemSaved);
  }, [mutate]);

  return null;
}
