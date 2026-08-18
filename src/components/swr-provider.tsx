"use client";

import { SWRConfig, type Cache } from "swr";
import { fetcher } from "@/lib/fetcher";

const CACHE_KEY = "glint:swr-cache";

/**
 * Persists SWR's cache to localStorage and restores it on the next load
 * — so reopening the app (a full process restart in the Electron shell,
 * not just a re-focus) shows the last-known Library/Notes/Tasks content
 * INSTANTLY instead of a blank skeleton for however long this app's
 * Neon round trip takes (measured at 2-3s+ per query even for "trivial"
 * reads — a Vercel-function-to-Neon/cold-start cost, not something
 * fixable from the client). SWR still revalidates in the background on
 * every mount exactly as before; this only changes what's shown WHILE
 * that's in flight, from nothing to "probably still correct."
 *
 * Flushes on a short interval (not just `beforeunload`, which doesn't
 * reliably fire for a force-quit or killed process) and once more on
 * unload as a final catch-all. Wrapped in try/catch since localStorage
 * can throw (Safari private mode, quota exceeded) — caching is a nice-
 * to-have, never something that should be able to crash the app.
 */
function localStorageProvider(): Cache {
  let map: Map<string, unknown>;
  try {
    map = new Map(JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]"));
  } catch {
    map = new Map();
  }

  function persist() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(Array.from(map.entries())));
    } catch {
      // Quota exceeded or unavailable — skip this write, cache still
      // works in-memory for the rest of the session.
    }
  }

  window.addEventListener("beforeunload", persist);
  setInterval(persist, 5000);

  return map as unknown as Cache;
}

export function SwrProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        // localStorageProvider itself only actually runs once — SWRConfig
        // calls it a single time internally to seed its cache, regardless
        // of how many times this component re-renders — so passing the
        // (stable, top-level) function reference directly is enough; no
        // ref/lazy-init dance needed. Guarded for SSR, where `window`
        // (and therefore localStorage) doesn't exist.
        provider: typeof window !== "undefined" ? localStorageProvider : undefined,
        // This is a single-user personal app, not a multi-session
        // real-time dashboard — the default `revalidateOnFocus: true`
        // was silently re-fetching every mounted query (items, tags,
        // colors, collections…) on every window/tab focus, each one a
        // full network round trip. Against this app's DB latency that
        // read as a multi-second stall on nearly every alt-tab back in —
        // the single biggest contributor to the "feels awfully slow"
        // complaint. Data still loads fresh on mount/navigation and
        // after every mutation (all writes already call `mutate()`
        // explicitly), so nothing goes stale in practice.
        revalidateOnFocus: false,
        dedupingInterval: 4000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
