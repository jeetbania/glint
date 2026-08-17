"use client";

import { SWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";

export function SwrProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
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
