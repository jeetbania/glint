"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { animate } from "motion";
import { Folder, Plus, MoreHorizontal, Pencil, Trash2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollectionActions } from "@/lib/use-collection-actions";
import { hueForIndex } from "@/lib/folder-color";
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

// Colors: a single pastel hue per folder, rendered as translucent
// frosted glass (blur + partial opacity) rather than an opaque fill —
// per explicit feedback, not a gradient and not a flat sticker. Hue is
// assigned by position (golden-angle spacing, ~137.5° apart) rather
// than hashed from the id, so no two folders can land on the same
// color regardless of how many exist — and it's the same hue the Notes
// sidebar uses for this folder's icon (see lib/folder-color.ts), so a
// given folder reads as one consistent color everywhere it shows up.

// Fan-out hover animation for the peeking preview images — restored
// from the pre-Paper-mockup version. Imperative animate() calls on
// refs (not declarative whileHover props) matching jeetcreates.cc's
// own Folder.tsx, since the declarative path glitches on first hover.
const OPEN_SPRING = { type: "spring", stiffness: 260, damping: 22 } as const;
const CLOSE_SPRING = { type: "spring", stiffness: 300, damping: 26 } as const;
const REST = [
  { x: -22, y: 10, rotate: -9 },
  { x: 0, y: -2, rotate: 0 },
  { x: 22, y: 10, rotate: 9 },
];
const OPEN_POS = [
  { x: -38, y: -4, rotate: -15 },
  { x: 0, y: -18, rotate: 0 },
  { x: 38, y: -4, rotate: 15 },
];

function FolderTile({
  collection,
  hue,
  active,
}: {
  collection: CollectionPreview;
  hue: number;
  active: boolean;
}) {
  const { rename, remove } = useCollectionActions();
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(collection.name);
  const imgRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Prime Motion's own tracked transform state to match the REST values
  // already painted via inline `style` below — without this, Motion has
  // no baseline on the first animate() call (hover), and can spin a
  // card the "long way around" (360°) instead of a few degrees.
  useEffect(() => {
    imgRefs.current.forEach((el, i) => {
      if (!el) return;
      const pos = REST[i] ?? REST[REST.length - 1];
      animate(el, { x: pos.x, y: pos.y, rotate: pos.rotate }, { duration: 0 });
    });
  }, []);

  function open() {
    imgRefs.current.forEach((el, i) => {
      if (!el) return;
      const pos = OPEN_POS[i] ?? OPEN_POS[OPEN_POS.length - 1];
      animate(el, { x: pos.x, y: pos.y, rotate: pos.rotate }, OPEN_SPRING);
    });
  }
  function close() {
    imgRefs.current.forEach((el, i) => {
      if (!el) return;
      const pos = REST[i] ?? REST[REST.length - 1];
      animate(el, { x: pos.x, y: pos.y, rotate: pos.rotate }, CLOSE_SPRING);
    });
  }

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
          onPointerEnter={open}
          onPointerLeave={close}
          style={{ "--folder-hue": hue } as React.CSSProperties}
          className={cn(
            "group relative h-60 w-56 shrink-0 overflow-hidden rounded-[22px] shadow-[0_10px_28px_-12px_rgba(0,0,0,0.4)] transition-transform duration-150 [perspective:800px] hover:scale-[1.02]",
            active && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          )}
        >
          <Link
            href={isRenaming ? "#" : `/collections/${collection.slug}`}
            onClick={(e) => isRenaming && e.preventDefault()}
            aria-label={collection.name}
            className="absolute inset-0 z-0"
          />

          {/* Full-bleed frosted color — the folder itself. */}
          <div className="folder-card-glass pointer-events-none absolute inset-0 z-0" />

          {/* Fanned previews, peeking above the top edge on hover —
              anchored to the upper zone so they read as tucked into the
              card rather than floating loose. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] flex h-[42%] items-center justify-center">
            {collection.previews.length > 0 ? (
              collection.previews.slice(0, 3).map((src, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    imgRefs.current[i] = el;
                  }}
                  className="absolute size-24 overflow-hidden rounded-xl border border-white/30 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.45)] will-change-transform"
                  style={{
                    transform: `translate(${REST[i]?.x ?? 0}px, ${REST[i]?.y ?? 0}px) rotate(${REST[i]?.rotate ?? 0}deg)`,
                  }}
                >
                  <Image src={src} alt="" fill className="object-cover" unoptimized />
                </div>
              ))
            ) : (
              <Folder className="size-8 text-white/80" />
            )}
          </div>

          {/* Bottom scrim + text — sits directly on the glass, same
              composition as the reference, just less space between this
              and the peeking images now that the card is shorter. */}
          <div className="folder-card-scrim pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex h-[62%] flex-col justify-end gap-2 p-3.5">
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
                className="pointer-events-auto min-w-0 rounded bg-white/15 px-1 -mx-1 font-heading text-lg font-semibold tracking-heading text-white outline-none"
              />
            ) : (
              <p className="truncate font-heading text-lg font-semibold tracking-heading text-white">
                {collection.name}
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {collection.count} {collection.count === 1 ? "save" : "saves"}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`More options for ${collection.name}`}
                      // Theme-aware translucent circle (same recipe as
                      // .glass-pill) instead of a hardcoded white one —
                      // a flat white/90 circle read fine against the old
                      // light-mode gradient but looked stuck-on and out
                      // of place in dark mode.
                      className="glass-pill pointer-events-auto flex size-8 shrink-0 items-center justify-center rounded-full text-foreground opacity-0 transition-opacity hover:brightness-105 group-hover:opacity-100 data-popup-open:opacity-100"
                    />
                  }
                >
                  <MoreHorizontal className="size-4" />
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
      {collections.map((c, i) => (
        <FolderTile
          key={c.id}
          collection={c}
          hue={hueForIndex(i)}
          active={activeSlug === c.slug}
        />
      ))}

      {creating ? (
        <div className="glass-panel flex h-60 w-56 shrink-0 flex-col items-center justify-center gap-2 rounded-[22px] p-3">
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
          className="flex h-60 w-56 shrink-0 flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-border/60 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <Plus className="size-5" />
          New collection
        </button>
      )}
    </div>
  );
}
