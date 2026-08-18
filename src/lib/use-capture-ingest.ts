"use client";

import { useCallback } from "react";
import { upload } from "@vercel/blob/client";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { extractImageColors } from "@/lib/color-extraction-client";

/** A pasted/copied string counts as a link only if it's a single bare
 * http(s) URL — a paragraph that merely contains a URL is treated as a
 * note instead. */
export function asUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // not a URL
  }
  return null;
}

function readImageDimensions(
  blob: Blob,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  });
}

/** The shared "turn this into a saved item" logic behind both paste/drop
 * capture (PasteCaptureProvider) and the Electron clipboard-watcher
 * (ClipboardWatchProvider) — one save path, two triggers. */
export function useCaptureIngest() {
  const { mutate } = useSWRConfig();

  const refreshLibrary = useCallback(() => {
    void mutate(
      (key) => typeof key === "string" && key.startsWith("/api/items"),
    );
  }, [mutate]);

  const ingestImage = useCallback(
    async (file: File) => {
      // Cancelable via the toast's own Cancel button — one AbortController
      // shared by the blob upload and the follow-up /api/items POST, so
      // hitting Cancel mid-upload actually stops the network request
      // instead of just hiding the toast while the upload keeps running.
      const controller = new AbortController();
      const toastId = toast.loading(`Saving ${file.name || "image"}…`, {
        cancel: { label: "Cancel", onClick: () => controller.abort() },
      });
      try {
        const [colors, dims, blob] = await Promise.all([
          extractImageColors(file),
          readImageDimensions(file),
          upload(file.name || `pasted-${Date.now()}.png`, file, {
            access: "public",
            handleUploadUrl: "/api/blob/upload-token",
            abortSignal: controller.signal,
          }),
        ]);

        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "image",
            blobUrl: blob.url,
            blobPathname: blob.pathname,
            width: dims.width || undefined,
            height: dims.height || undefined,
            fileSizeBytes: file.size,
            mimeType: file.type,
            dominantColors: colors?.dominantColors ?? [],
            colorFamily: colors?.colorFamily ?? [],
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to save image");
        refreshLibrary();
        toast.success("Image saved", { id: toastId });
      } catch (error) {
        if (controller.signal.aborted) {
          toast("Upload canceled", { id: toastId });
          return;
        }
        console.error(error);
        toast.error("Couldn't save image", { id: toastId });
      }
    },
    [refreshLibrary],
  );

  const ingestText = useCallback(
    async (text: string) => {
      const url = asUrl(text);
      const controller = new AbortController();
      const toastId = toast.loading(url ? "Saving link…" : "Saving note…", {
        cancel: { label: "Cancel", onClick: () => controller.abort() },
      });
      try {
        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            url ? { type: "link", url } : { type: "note", bodyText: text },
          ),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to save");
        refreshLibrary();
        toast.success(url ? "Link saved" : "Note saved", { id: toastId });
      } catch (error) {
        if (controller.signal.aborted) {
          toast("Save canceled", { id: toastId });
          return;
        }
        console.error(error);
        toast.error("Couldn't save", { id: toastId });
      }
    },
    [refreshLibrary],
  );

  return { ingestImage, ingestText, refreshLibrary };
}
