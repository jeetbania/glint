"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { extractImageColors } from "@/lib/color-extraction-client";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/** A pasted string counts as a link only if it's a single bare http(s) URL
 * — a paragraph that merely contains a URL is treated as a note instead. */
function asUrl(text: string): string | null {
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

/**
 * Mounted once in the (app) layout. Captures paste (Cmd+V) and drag-drop
 * of images/text/links anywhere in the app and turns them into items —
 * this is the core "just paste it in" capture path the whole app is built
 * around. Bails out entirely when focus is inside an editable field so
 * native paste (e.g. typing in a note) is never hijacked.
 */
export function PasteCaptureProvider() {
  const { mutate } = useSWRConfig();
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragDepth = useRef(0);

  const refreshLibrary = useCallback(() => {
    void mutate(
      (key) => typeof key === "string" && key.startsWith("/api/items"),
    );
  }, [mutate]);

  const ingestImage = useCallback(
    async (file: File) => {
      const toastId = toast.loading(`Saving ${file.name || "image"}…`);
      try {
        const [colors, dims, blob] = await Promise.all([
          extractImageColors(file),
          readImageDimensions(file),
          upload(file.name || `pasted-${Date.now()}.png`, file, {
            access: "public",
            handleUploadUrl: "/api/blob/upload-token",
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
        });
        if (!res.ok) throw new Error("Failed to save image");
        refreshLibrary();
        toast.success("Image saved", { id: toastId });
      } catch (error) {
        console.error(error);
        toast.error("Couldn't save image", { id: toastId });
      }
    },
    [refreshLibrary],
  );

  const ingestText = useCallback(
    async (text: string) => {
      const url = asUrl(text);
      const toastId = toast.loading(url ? "Saving link…" : "Saving note…");
      try {
        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            url ? { type: "link", url } : { type: "note", bodyText: text },
          ),
        });
        if (!res.ok) throw new Error("Failed to save");
        refreshLibrary();
        toast.success(url ? "Link saved" : "Note saved", { id: toastId });
      } catch (error) {
        console.error(error);
        toast.error("Couldn't save", { id: toastId });
      }
    },
    [refreshLibrary],
  );

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (isEditableTarget(event.target)) return;
      const dataItems = event.clipboardData?.items;
      if (!dataItems || dataItems.length === 0) return;

      const imageFiles: File[] = [];
      for (const item of dataItems) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        event.preventDefault();
        imageFiles.forEach((file) => void ingestImage(file));
        return;
      }

      const textItem = Array.from(dataItems).find(
        (item) => item.kind === "string" && item.type === "text/plain",
      );
      if (textItem) {
        event.preventDefault();
        textItem.getAsString((text) => {
          if (text && text.trim()) void ingestText(text);
        });
      }
    }

    function handleDragOver(event: DragEvent) {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      dragDepth.current += 1;
      setIsDraggingOver(true);
    }

    function handleDragLeave() {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDraggingOver(false);
    }

    function handleDrop(event: DragEvent) {
      dragDepth.current = 0;
      setIsDraggingOver(false);
      if (isEditableTarget(event.target)) return;
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;
      event.preventDefault();
      Array.from(files)
        .filter((file) => file.type.startsWith("image/"))
        .forEach((file) => void ingestImage(file));
    }

    window.addEventListener("paste", handlePaste);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [ingestImage, ingestText]);

  if (!isDraggingOver) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center border-4 border-dashed border-primary bg-primary/5">
      <p className="rounded-lg bg-background px-4 py-2 text-sm font-medium shadow-lg">
        Drop to save
      </p>
    </div>
  );
}
