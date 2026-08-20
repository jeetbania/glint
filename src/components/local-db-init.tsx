"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { seedLocalDbIfEmpty } from "@/lib/local/seed";

/** Mounted once in the (app) layout, before anything else reads local
 * data. Populates a brand-new local store with bundled demo content
 * (see lib/local/seed.ts) — a no-op after the very first run, or on any
 * browser that already has real saved items. */
export function LocalDbInit() {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    let cancelled = false;
    void seedLocalDbIfEmpty().then(() => {
      if (!cancelled) void mutate(() => true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
