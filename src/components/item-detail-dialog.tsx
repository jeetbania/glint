"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { X, Trash2, ExternalLink, Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TagEditor } from "@/components/tag-editor";
import { NoteEditor } from "@/components/note-editor";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import type { ApiItem } from "@/types/item";
import type { JSONContent } from "@tiptap/react";

/** Blends up to 3 of the item's dominant colors into offset radial
 * gradients — an Apple-TV-style ambient wash behind the lightbox content,
 * rather than one flat tinted circle. */
function buildAmbientGlow(
  colors: { hex: string; percentage: number }[] | null | undefined,
): string | null {
  if (!colors || colors.length === 0) return null;
  const positions = [
    "35% 25%",
    "75% 65%",
    "20% 80%",
  ];
  return colors
    .slice(0, 3)
    .map(
      (c, i) =>
        `radial-gradient(45% 45% at ${positions[i]}, ${c.hex}, transparent 70%)`,
    )
    .join(", ");
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
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
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
  const [title, setTitle] = useState(item.title ?? "");

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

  const glow = buildAmbientGlow(item.dominantColors);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 blur-[130px]"
          style={{ backgroundImage: glow }}
        />
      )}

      <div className="relative z-10 flex shrink-0 items-center justify-between px-5 py-4">
        <DialogPrimitive.Close render={<Button variant="outline" size="icon-sm" />}>
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
        <DialogPrimitive.Title className="sr-only">
          {item.title ?? item.type}
        </DialogPrimitive.Title>
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

      <div className="relative z-10 flex min-h-0 flex-1 gap-4 px-5 pb-5">
        <div className="flex min-w-0 flex-1 items-center justify-center overflow-hidden">
          <MainVisual item={item} onNoteUpdate={saveNote} />
        </div>

        <aside className="glass-panel hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl p-4 md:flex">
          {item.dominantColors && item.dominantColors.length > 0 && (
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
          )}

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

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Collections
            </p>
            <TagEditor
              tags={item.collections.map((c) => c.name)}
              onChange={saveCollections}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Tags</p>
            <TagEditor tags={item.tags.map((t) => t.name)} onChange={saveTags} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function MainVisual({
  item,
  onNoteUpdate,
}: {
  item: ApiItem;
  onNoteUpdate: (payload: { json: JSONContent; text: string }) => void;
}) {
  if (item.type === "image" && item.blobUrl) {
    return (
      <Image
        src={item.blobUrl}
        alt={item.title ?? "Saved image"}
        width={item.width ?? 1200}
        height={item.height ?? 900}
        className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        unoptimized
      />
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
    <div className="glass-panel h-full max-h-[70vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6">
      <NoteEditor
        content={(item.bodyJson as JSONContent) ?? item.bodyText}
        onUpdate={onNoteUpdate}
      />
    </div>
  );
}
