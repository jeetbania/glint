"use client";

import type {
  ColorExtractionRequest,
  ColorExtractionResponse,
} from "@/workers/color-extraction.worker";

export type ExtractedColors = {
  dominantColors: { hex: string; percentage: number }[];
  colorFamily: string[];
};

let worker: Worker | null = null;
const pending = new Map<string, (res: ColorExtractionResponse) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("../workers/color-extraction.worker.ts", import.meta.url),
    );
    worker.onmessage = (event: MessageEvent<ColorExtractionResponse>) => {
      const resolve = pending.get(event.data.id);
      if (resolve) {
        resolve(event.data);
        pending.delete(event.data.id);
      }
    };
  }
  return worker;
}

/** Runs dominant-color extraction off the main thread so pasting a large
 * screenshot never blocks the UI. Resolves to null on failure — callers
 * should still save the item, just without a color palette. */
export function extractImageColors(blob: Blob): Promise<ExtractedColors | null> {
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    pending.set(id, (res) => {
      if (res.ok) {
        resolve({ dominantColors: res.dominantColors, colorFamily: res.colorFamily });
      } else {
        resolve(null);
      }
    });
    const request: ColorExtractionRequest = { id, blob };
    getWorker().postMessage(request);
  });
}
