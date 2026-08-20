/** Local, fully-offline OCR — tesseract.js, with its worker script, WASM
 * core, and English trained-data file bundled into public/tesseract/
 * (see that folder) instead of the library's own default (a jsdelivr
 * CDN fetch on first use). Consistent with everything else in this app:
 * a screenshot's text never has to leave the device to be read.
 *
 * Only ever invoked lazily (dynamic import, worker created on first real
 * call) — nothing in this file is pulled into the main app bundle or
 * touches the network until OCR actually runs on a saved image. */

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return createWorker("eng", 1 /* OEM.LSTM_ONLY */, {
        workerPath: "/tesseract/worker.min.js",
        // Points at the exact bundled file (ends in .js) rather than a
        // bare folder — tesseract.js's own feature-detection otherwise
        // tries relaxed-SIMD or non-SIMD variants first depending on
        // the browser, neither of which is bundled here. Plain WASM
        // SIMD (this one file) is broadly supported by every browser
        // this app targets, so there's no real benefit to auto-picking
        // — only a real failure mode when the picked variant is a file
        // that was never copied into public/tesseract/.
        corePath: "/tesseract/tesseract-core-simd-lstm.wasm.js",
        langPath: "/tesseract",
        gzip: false,
      });
    })();
  }
  return workerPromise;
}

/** Runs OCR on an image and returns whatever text it found (empty
 * string if none, or if OCR fails for any reason — this is a soft-fail
 * enhancement, never something that should block or error out a save). */
export async function runOcr(blob: Blob): Promise<string> {
  try {
    const worker = await getWorker();
    const {
      data: { text },
    } = await worker.recognize(blob);
    return text.trim();
  } catch (error) {
    console.error("[ocr] failed", error);
    return "";
  }
}
