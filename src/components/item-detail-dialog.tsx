"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
  X,
  Trash2,
  Download,
  ExternalLink,
  Link as LinkIcon,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TagEditor } from "@/components/tag-editor";
import { NoteEditor } from "@/components/note-editor";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useCollectionNames, useTagNames } from "@/lib/use-suggestions";
import type { ApiItem } from "@/types/item";
import type { JSONContent } from "@tiptap/react";

/** Closes the dialog only when the click landed on the element the
 * listener is attached to (not a descendant) — lets any genuinely empty
 * stretch of backdrop close the lightbox without swallowing clicks on
 * the image, header buttons, or the details panel. */
function closeOnEmptyClick(onClose: () => void) {
  return (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };
}

export function ItemDetailDialog({
  itemId,
  onOpenChange,
}: {
  itemId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data } = useSWR<{ item: ApiItem }>(
    itemId ? `/api/items/${itemId}` : null,
  );
  const item = data?.item;

  return (
    <DialogPrimitive.Root open={!!itemId} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed inset-0 z-50 outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          {item ? (
            <ItemDetailContent
              key={item.id}
              item={item}
              onClose={() => onOpenChange(false)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/50">
              Loading…
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ItemDetailContent({
  item,
  onClose,
}: {
  item: ApiItem;
  onClose: () => void;
}) {
  const { mutate: globalMutate } = useSWRConfig();
  const { mutate } = useSWR<{ item: ApiItem }>(`/api/items/${item.id}`);
  const collectionNames = useCollectionNames();
  const tagNames = useTagNames();
  const [title, setTitle] = useState(item.title ?? "");
  const [zoom, setZoom] = useState(1);

  const refreshLibrary = () =>
    globalMutate(
      (key) => typeof key === "string" && key.startsWith("/api/items"),
    );

  const saveTitle = useDebouncedCallback(async (value: string) => {
    await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: value }),
    });
    mutate();
    refreshLibrary();
  }, 600);

  const saveNote = useDebouncedCallback(
    async (payload: { json: JSONContent; text: string }) => {
      await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyJson: payload.json, bodyText: payload.text }),
      });
      refreshLibrary();
    },
    800,
  );

  async function saveTags(tags: string[]) {
    await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    mutate();
    refreshLibrary();
  }

  async function saveCollections(names: string[]) {
    await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collections: names }),
    });
    mutate();
    void globalMutate("/api/collections");
    refreshLibrary();
  }

  async function handleDelete() {
    await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    toast.success("Deleted");
    onClose();
    refreshLibrary();
  }

  const bgImage = item.blobUrl ?? item.previewImageUrl;
  const downloadHref = item.blobUrl ?? item.previewImageUrl;

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden bg-black"
      onClick={closeOnEmptyClick(onClose)}
    >
      {/* Background is the image itself — zoomed, blurred, and darkened —
          rather than a color-extraction glow, per the reference. */}
      {bgImage ? (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <Image
            src={bgImage}
            alt=""
            fill
            className="scale-110 object-cover opacity-50 blur-3xl"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/80" />
        </div>
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-black" />
      )}

      <div
        data-item-detail-header
        className="relative z-10 flex shrink-0 items-center justify-between px-6 py-3"
      >
        <DialogPrimitive.Close render={<Button variant="outline" size="icon-sm" />}>
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
        <DialogPrimitive.Title className="sr-only">
          {item.title ?? item.type}
        </DialogPrimitive.Title>
        <div className="flex items-center gap-1.5">
          {downloadHref && (
            <Button
              variant="outline"
              size="icon-sm"
              render={<a href={downloadHref} download target="_blank" rel="noreferrer" />}
              aria-label="Download"
            >
              <Download className="size-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive"
            aria-label="Delete"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 gap-4 px-6 pb-6">
        <div
          className="flex min-w-0 flex-1 items-center justify-center overflow-hidden"
          onClick={closeOnEmptyClick(onClose)}
        >
          <MainVisual item={item} zoom={zoom} onNoteUpdate={saveNote} />
        </div>

        <aside className="glass-panel hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl p-4 md:flex">
          <TiltThumbnail item={item} />

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Name</p>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                saveTitle(e.target.value);
              }}
              placeholder="Untitled"
              className="font-heading font-semibold tracking-heading"
            />
          </div>

          {item.type === "link" && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">URL</p>
              <a
                href={item.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 truncate text-xs text-primary hover:underline"
              >
                <LinkIcon className="size-3 shrink-0" />
                <span className="truncate">{item.url}</span>
              </a>
            </div>
          )}

          {item.dominantColors && item.dominantColors.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Colors</p>
              <div className="flex flex-wrap gap-1.5">
                {item.dominantColors.map((c, i) => (
                  <span
                    key={i}
                    title={c.hex}
                    className="size-6 rounded-full border border-white/10 shadow-sm"
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Collections
            </p>
            <TagEditor
              tags={item.collections.map((c) => c.name)}
              onChange={saveCollections}
              suggestions={collectionNames}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Tags</p>
            <TagEditor
              tags={item.tags.map((t) => t.name)}
              onChange={saveTags}
              suggestions={tagNames}
            />
          </div>
        </aside>
      </div>

      {item.type === "image" && (
        // Positioning and glass-styling deliberately live on separate
        // nodes — .glass-pill's (layered) `position: relative` otherwise
        // beats an `absolute` utility on the same element under CSS
        // cascade layers, leaving this stuck in normal flow below the fold.
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
          <div className="glass-pill flex items-center gap-2 px-3 py-1.5">
            <ZoomOut className="size-3.5 text-muted-foreground" />
            <input
              type="range"
              min={1}
              max={2.5}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
              aria-label="Zoom"
            />
            <ZoomIn className="size-3.5 text-muted-foreground" />
          </div>
        </div>
      )}
    </div>
  );
}

/** Small preview card in the details panel that tilts in 3D toward the
 * cursor like a physical photo, plus a looping shimmer sweep so the
 * panel doesn't feel static even before you touch it. */
function TiltThumbnail({ item }: { item: ApiItem }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const src = item.blobUrl ?? item.previewImageUrl;
  if (!src) return null;

  const ratio = item.width && item.height ? item.width / item.height : 1;

  function onMove(e: React.MouseEvent) {
    const rect = ref.current!.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({ rx: (0.5 - py) * 16, ry: (px - 0.5) * 16 });
  }

  return (
    <div className="w-full shrink-0 [perspective:800px]">
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
        className="shimmer-sweep relative max-h-64 w-full overflow-hidden rounded-2xl shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5)] transition-transform duration-150 ease-out will-change-transform"
        style={{ aspectRatio: ratio, transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)` }}
      >
        <Image src={src} alt="" fill className="object-cover" unoptimized />
      </div>
    </div>
  );
}

function MainVisual({
  item,
  zoom,
  onNoteUpdate,
}: {
  item: ApiItem;
  zoom: number;
  onNoteUpdate: (payload: { json: JSONContent; text: string }) => void;
}) {
  if (item.type === "image" && item.blobUrl) {
    // `fill` + an explicit aspect-ratio on this wrapper (rather than
    // intrinsic width/height + max-* constraints directly on the <img>)
    // sizes the box itself to the image's real aspect ratio. The
    // previous approach left the <img>'s own layout box stretched to
    // its flex container's full size — object-contain only shrinks the
    // *painted pixels* within a box, not the box itself — so the
    // invisible remainder of that box silently ate clicks meant to
    // close the dialog (target === flex-1 container never matched).
    const ratio = item.width && item.height ? item.width / item.height : 4 / 3;
    return (
      <div
        className="relative max-h-[calc(100vh-11rem)] max-w-full transition-transform duration-150 ease-out"
        style={{ aspectRatio: ratio, height: "100%", width: "auto", transform: `scale(${zoom})` }}
      >
        <Image
          src={item.blobUrl}
          alt={item.title ?? "Saved image"}
          fill
          sizes="80vw"
          className="rounded-lg object-contain shadow-2xl"
          unoptimized
        />
      </div>
    );
  }

  if (item.type === "link") {
    return (
      <a
        href={item.url ?? "#"}
        target="_blank"
        rel="noreferrer"
        className="group/link glass-panel relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl"
      >
        {item.previewImageUrl ? (
          <div className="relative aspect-video w-full bg-muted">
            <Image
              src={item.previewImageUrl}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : null}
        <div className="flex items-center gap-3 p-5">
          {item.faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.faviconUrl} alt="" className="size-8 shrink-0 rounded" />
          ) : (
            <LinkIcon className="size-8 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-base font-semibold tracking-heading">
              {item.title ?? item.url}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {item.domain ?? item.url}
            </p>
          </div>
          <ExternalLink className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
        </div>
      </a>
    );
  }

  // note & task
  return (
    <div
      className="glass-panel h-full max-h-[70vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6"
      onClick={(e) => e.stopPropagation()}
    >
      <NoteEditor
        content={(item.bodyJson as JSONContent) ?? item.bodyText}
        onUpdate={onNoteUpdate}
      />
    </div>
  );
}
