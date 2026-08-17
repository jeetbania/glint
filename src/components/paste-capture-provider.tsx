"use client";

import { useEffect, useRef, useState } from "react";
import { useCaptureIngest } from "@/lib/use-capture-ingest";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/**
 * Mounted once in the (app) layout. Captures paste (Cmd+V) and drag-drop
 * of images/text/links anywhere in the app and turns them into items —
 * this is the core "just paste it in" capture path the whole app is built
 * around. Bails out entirely when focus is inside an editable field so
 * native paste (e.g. typing in a note) is never hijacked.
 */
export function PasteCaptureProvider() {
  const { ingestImage, ingestText } = useCaptureIngest();
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragDepth = useRef(0);

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
