"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Plus, MoreHorizontal, Pencil, Trash2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollectionActions } from "@/lib/use-collection-actions";
import { renderMenuActions, type MenuAction } from "@/components/ui/menu-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

type CollectionPreview = {
  id: string;
  name: string;
  slug: string;
  count: number;
  previews: string[];
};

// Card design ported from the user's own Paper mockup — a fixed dark
// frame (#2A2A2A body, #1C1C1C info panel) with only the top gradient
// swatch varying between folders. The mockup hardcodes one oklab
// gradient; we keep its exact lightness/chroma "recipe" (a muted, pale
// wash, not a vivid saturated one) and rotate only the hue per folder,
// derived deterministically from the collection id so a given folder's
// color is stable across reloads and reorders.
const HUES = [8, 48, 100, 165, 225, 280] as const;
function hueFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return HUES[Math.abs(hash) % HUES.length];
}
function swatchGradient(hue: number): string {
  return `linear-gradient(180deg, oklch(76% 0.09 ${hue}) 0%, oklch(72% 0.09 ${hue}) 100%)`;
}

function FolderTile({
  collection,
  active,
}: {
  collection: CollectionPreview;
  active: boolean;
}) {
  const hue = hueFor(collection.id);
  const { rename, remove } = useCollectionActions();
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(collection.name);

  async function submitRename() {
    setIsRenaming(false);
    if (draft.trim() === collection.name || !draft.trim()) {
      setDraft(collection.name);
      return;
    }
    const ok = await rename(collection.id, collection.slug, draft);
    if (!ok) setDraft(collection.name);
  }

  const actions: MenuAction[] = [
    {
      label: "Open",
      icon: FolderOpen,
      onClick: () => router.push(`/collections/${collection.slug}`),
    },
    {
      label: "Rename",
      icon: Pencil,
      onClick: () => {
        setDraft(collection.name);
        setIsRenaming(true);
      },
    },
    {
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      onClick: () => remove(collection.slug, collection.name),
    },
  ];

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        {/* The Link is a full-cover sibling underneath everything else,
            not a wrapper — the kebab button below needs its own click
            target, and a <button> nested inside an <a> is invalid HTML
            (and risks the click bubbling into Link's navigation despite
            preventDefault). Every visual layer above the Link is
            pointer-events-none by default so clicks fall through to it,
            except the couple of controls that opt back in explicitly. */}
        <div
          className={cn(
            "group relative size-60 shrink-0 overflow-hidden rounded-[22px] bg-[#2A2A2A] transition-transform duration-150 hover:scale-[1.02]",
            active && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          )}
        >
          <Link
            href={isRenaming ? "#" : `/collections/${collection.slug}`}
            onClick={(e) => isRenaming && e.preventDefault()}
            aria-label={collection.name}
            className="absolute inset-0 z-0"
          />

          {/* Top swatch — hue rotates per folder, lightness/chroma fixed. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1.5 top-1.5 z-0 h-[110px] w-57 rounded-t-[15px]"
            style={{ backgroundImage: swatchGradient(hue) }}
          />

          {/* Info panel — deliberately overlaps the swatch's bottom edge
              (top-24 vs. the swatch's own 6px+110px=116px reach) so it
              reads as a flap sitting over a folder's pocket. */}
          <div className="pointer-events-none absolute left-1.5 top-24 z-[1] flex h-34.5 w-57.25 flex-col justify-between rounded-[14px] bg-[#1C1C1C] px-3.5 py-2.5">
            {isRenaming ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") submitRename();
                  if (e.key === "Escape") {
                    setDraft(collection.name);
                    setIsRenaming(false);
                  }
                }}
                onBlur={submitRename}
                className="pointer-events-auto min-w-0 rounded bg-white/10 px-1 -mx-1 font-heading text-base font-medium tracking-heading text-white outline-none"
              />
            ) : (
              <p className="truncate font-heading text-base font-medium tracking-heading text-white">
                {collection.name}
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] tracking-heading text-white/60">
                {collection.count} {collection.count === 1 ? "save" : "saves"}
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`More options for ${collection.name}`}
                      className="pointer-events-auto flex size-6 shrink-0 items-center justify-center rounded-full text-white/60 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100 data-popup-open:opacity-100"
                    />
                  }
                >
                  <MoreHorizontal className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {renderMenuActions(actions, DropdownMenuItem, DropdownMenuShortcut)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {renderMenuActions(actions, ContextMenuItem, ContextMenuShortcut)}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** "Folder" tiles for the reference app's Collections concept — a
 * lightweight, user-named grouping shown as a horizontal row above the
 * Library grid. Clicking one opens its dedicated infinite-canvas space
 * (see /collections/[slug]), not an inline filter. */
export function CollectionsRow({ activeSlug }: { activeSlug?: string | null }) {
  const { data, mutate } = useSWR<{ collections: CollectionPreview[] }>(
    "/api/collections",
  );
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");

  const collections = data?.collections ?? [];

  async function submitCreate() {
    const name = draft.trim();
    setCreating(false);
    setDraft("");
    if (!name) return;
    await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    mutate();
  }

  return (
    // `shrink-0` is load-bearing, not decorative: LibraryView's root is a
    // fixed-height column flex container, and `overflow-x-auto` here
    // forces `overflow-y` to also compute as non-`visible` per the CSS
    // Overflow spec — which strips this row's flexbox automatic minimum
    // height, letting the masonry grid below squeeze it down to a
    // near-zero sliver instead of its real tile height.
    <div className="flex shrink-0 items-end gap-4 overflow-x-auto px-6 pb-1 pt-8">
      {collections.map((c) => (
        <FolderTile key={c.id} collection={c} active={activeSlug === c.slug} />
      ))}

      {creating ? (
        <div className="glass-panel flex size-60 shrink-0 flex-col items-center justify-center gap-2 rounded-[22px] p-3">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCreate();
              if (e.key === "Escape") {
                setCreating(false);
                setDraft("");
              }
            }}
            onBlur={submitCreate}
            placeholder="Collection name"
            className="w-full rounded-md bg-transparent text-center text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="glass-panel flex size-60 shrink-0 flex-col items-center justify-center gap-2 rounded-[22px] text-sm text-muted-foreground transition-all hover:brightness-105"
        >
          <Plus className="size-5" />
          New collection
        </button>
      )}
    </div>
  );
}
