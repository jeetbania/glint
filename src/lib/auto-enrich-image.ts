import { localFetch } from "@/lib/local/api";
import { runOcr } from "@/lib/ocr";
import { suggestTagsFromText } from "@/lib/auto-tag";
import { categorizeImage } from "@/lib/ai/categorize";
import { getAiSettings } from "@/lib/ai/settings";

const OCR_ENABLED_KEY = "glint:settings:ocr-enabled";

function isOcrEnabled(): boolean {
  try {
    const raw = localStorage.getItem(OCR_ENABLED_KEY);
    return raw == null ? true : (JSON.parse(raw) as boolean);
  } catch {
    return true;
  }
}

/** The background half of saving an image — kicked off (not awaited)
 * right after an image item is created, from every save path (paste/
 * drop, canvas "add image", the browser extension). Runs local OCR
 * (free, offline, on by default) and, only if the user explicitly
 * opted in with their own API key, sends the image to their chosen AI
 * provider for a second, smarter pass. Both are pure enhancement —
 * whatever tags/title they suggest get merged into the item once
 * they're ready, never blocking or delaying the save itself. */
export async function enrichSavedImage(itemId: string, blob: Blob): Promise<void> {
  try {
    const [ocrText, ai] = await Promise.all([
      isOcrEnabled() ? runOcr(blob) : Promise.resolve(""),
      (async () => {
        const settings = getAiSettings();
        if (!settings.autoCategorize) return null;
        return categorizeImage(blob, settings);
      })(),
    ]);

    const suggestedTags = [...suggestTagsFromText(ocrText), ...(ai?.tags ?? [])];
    if (!ocrText && suggestedTags.length === 0 && !ai?.title) return;

    const res = await localFetch(`/api/items/${itemId}`);
    if (!res.ok) return;
    const { item } = await res.json();

    const mergedTags = [...new Set([...item.tags.map((t: { name: string }) => t.name), ...suggestedTags])];

    await localFetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(ocrText ? { ocrText } : {}),
        ...(ai?.title && !item.title ? { title: ai.title } : {}),
        ...(mergedTags.length > item.tags.length ? { tags: mergedTags } : {}),
      }),
    });
  } catch (error) {
    console.error("[auto-enrich] failed", error);
  }
}
