import { extractColorsFromImageBitmap } from "extract-colors";
import { bucketColorFamily } from "@/lib/color";

export type ColorExtractionRequest = { id: string; blob: Blob };
export type ColorExtractionResponse =
  | {
      id: string;
      ok: true;
      dominantColors: { hex: string; percentage: number }[];
      colorFamily: string[];
    }
  | { id: string; ok: false; error: string };

self.onmessage = async (event: MessageEvent<ColorExtractionRequest>) => {
  const { id, blob } = event.data;
  try {
    const bitmap = await createImageBitmap(blob);
    // 20k sample pixels is plenty for dominant-color purposes and keeps
    // this fast even for large pasted screenshots.
    const colors = await extractColorsFromImageBitmap(bitmap, {
      pixels: 20000,
    });
    bitmap.close();

    const top = colors.slice(0, 5);
    const dominantColors = top.map((c) => ({
      hex: c.hex,
      percentage: Math.round(c.area * 1000) / 10,
    }));
    const colorFamily = [
      ...new Set(
        top.map((c) => bucketColorFamily(c.hue, c.saturation, c.lightness)),
      ),
    ];

    const response: ColorExtractionResponse = {
      id,
      ok: true,
      dominantColors,
      colorFamily,
    };
    self.postMessage(response);
  } catch (error) {
    const response: ColorExtractionResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    self.postMessage(response);
  }
};
