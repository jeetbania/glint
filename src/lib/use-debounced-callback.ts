"use client";

import { useEffect, useMemo, useRef } from "react";

/** Returns a stable debounced wrapper around `callback`. Pending calls are
 * flushed on unmount is intentionally NOT done here — callers that need a
 * guaranteed final save (e.g. closing a dialog) should call the immediate
 * version themselves. */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useMemo(() => {
    return (...args: Args) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => callbackRef.current(...args), delayMs);
    };
  }, [delayMs]);
}
