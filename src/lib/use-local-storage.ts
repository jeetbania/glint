"use client";

import { useEffect, useState } from "react";

/** Client-only persisted preference — for settings that are per-device
 * and don't need to sync anywhere (this is a single-user local app), so
 * localStorage is simpler and faster than round-tripping through the DB. */
export function useLocalStorage<T>(key: string, initial: T) {
  // Lazy-init reads localStorage synchronously on first render instead of
  // via an effect+setState — this hook is only ever used by
  // interaction-triggered UI (e.g. a settings dialog), never in output
  // that's part of the initial server-rendered HTML, so there's no
  // hydration-mismatch risk to guard against here.
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore write failures (private browsing quota, etc.).
    }
  }, [key, value]);

  return [value, setValue] as const;
}
