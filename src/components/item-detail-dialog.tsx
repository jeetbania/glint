"use client";

import { useState } from "react";
import Image from "next/image";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Trash2, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TagEditor } from "@/components/tag-editor";
import { NoteEditor } from "@/components/note-editor";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import type { ApiItem } from "@/types/item";
import type { JSONContent } from "@tiptap/react";

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
    <Dialog open={!!itemId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {!item ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          // Keyed by item.id so switching items remounts this and local
          // (title) state initializes fresh, instead of syncing it via
          // an effect.
          <ItemDetailContent
            key={item.id}
            item={item}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
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

  async function handleDelete() {
    await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    toast.success("Deleted");
    onClose();
    refreshLibrary();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="sr-only">{item.title ?? item.type}</DialogTitle>
      </DialogHeader>

      {item.type === "image" && item.blobUrl && (
        <div className="relative max-h-[45vh] w-full overflow-hidden rounded-md bg-muted">
          <Image
            src={item.blobUrl}
            alt={item.title ?? "Saved image"}
            width={item.width ?? 800}
            height={item.height ?? 600}
            className="max-h-[45vh] w-full object-contain"
            unoptimized
          />
        </div>
      )}

      {item.type === "link" && (
        <a
          href={item.url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-md border p-3 text-sm hover:bg-muted/50"
        >
          {item.previewImageUrl && (
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded bg-muted">
              <Image
                src={item.previewImageUrl}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{item.title ?? item.url}</p>
            <p className="truncate text-xs text-muted-foreground">
              {item.domain ?? item.url}
            </p>
          </div>
          <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
        </a>
      )}

      <Input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          saveTitle(e.target.value);
        }}
        placeholder="Untitled"
        className="border-none px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
      />

      {(item.type === "note" || item.type === "task") && (
        <NoteEditor
          content={(item.bodyJson as JSONContent) ?? item.bodyText}
          onUpdate={saveNote}
        />
      )}

      {item.dominantColors && item.dominantColors.length > 0 && (
        <div className="flex items-center gap-1.5">
          {item.dominantColors.map((c, i) => (
            <span
              key={i}
              title={c.hex}
              className="size-5 rounded-full border"
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Tags</p>
        <TagEditor tags={item.tags.map((t) => t.name)} onChange={saveTags} />
      </div>

      <div className="flex justify-end border-t pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>
    </>
  );
}
