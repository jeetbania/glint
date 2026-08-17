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

// Spring timing + fan-out transforms — imperative animate() calls on
// refs (not declarative whileHover props), matching jeetcreates.cc's own
// Folder.tsx, since animating transform via CSS/Motion's declarative
// path there left a visible glitch on first hover.
const OPEN_SPRING = { type: "spring", stiffness: 260, damping: 22 } as const;
const CLOSE_SPRING = { type: "spring", stiffness: 300, damping: 26 } as const;
const REST = [
  { x: -20, y: 8, rotate: -9 },
  { x: 0, y: -2, rotate: 0 },
  { x: 20, y: 8, rotate: 9 },
];
const OPEN_POS = [
  { x: -34, y: -8, rotate: -15 },
  { x: 0, y: -20, rotate: 0 },
  { x: 34, y: -8, rotate: 15 },
];

// Colorful pastel glass, not plain gray — deterministic per collection
// (hashed off its id, so a given folder keeps its color across reloads
// and reorders) rather than user-picked, echoing jeetcreates.cc's
// colorful project cards translated into glass instead of solid fills.
const TINTS = ["mint", "lavender", "peach", "sky", "rose", "sage"] as const;
function tintFor(id: string): (typeof TINTS)[number] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return TINTS[Math.abs(hash) % TINTS.length];
}

function FolderTile({
  collection,
  active,
}: {
  collection: CollectionPreview;
  active: boolean;
}) {
  // Vivid, opaque gradients here — not .glass-tint-*, which is a
  // low-alpha wash meant to sit over real page content behind it via
  // backdrop-filter. This card's own background IS the base layer with
  // nothing behind it, so that wash reads as near-black instead of
  // colorful. The reference card is a solid saturated gradient, and
  // .gradient-* (already used for item-type badges) is exactly that.
  const tint = `gradient-${tintFor(collection.id)}`;
  const imgRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { rename, remove } = useCollectionActions();
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(collection.name);

  // Prime Motion's own tracked transform state to match the REST values
  // already painted via inline `style` below. Without this, Motion has
  // no record of the element's current rotation on the very first
  // animate() call (hover), so it doesn't know which way is "shorter" —
  // it can end up spinning a card a full 360° instead of the intended
  // few degrees. A zero-duration animate() on mount fixes that without
  // any visible motion.
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
          className="group relative block size-52 shrink-0 overflow-hidden rounded-2xl [perspective:800px]"
        >
          <Link
            href={isRenaming ? "#" : `/collections/${collection.slug}`}
            onClick={(e) => isRenaming && e.preventDefault()}
            aria-label={collection.name}
            className="absolute inset-0 z-0"
          />

          {/* Full-bleed tinted background — the square "folder" itself. */}
          <div
            className={cn(
              tint,
              "pointer-events-none absolute inset-0 z-0 rounded-2xl",
              active && "ring-2 ring-primary",
            )}
          />

          {/* Fanned previews, peeking up from directly behind the label
              bar — anchored to the bottom of the top ~62% zone so they
              read as emerging from the folder's pocket, not floating. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-[38%] z-[1] flex items-end justify-center pb-1">
            {collection.previews.length > 0 ? (
              collection.previews.slice(0, 3).map((src, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    imgRefs.current[i] = el;
                  }}
                  className="absolute size-24 overflow-hidden rounded-xl border border-white/25 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.5)] will-change-transform"
                  style={{
                    transform: `translate(${REST[i]?.x ?? 0}px, ${REST[i]?.y ?? 0}px) rotate(${REST[i]?.rotate ?? 0}deg)`,
                  }}
                >
                  <Image src={src} alt="" fill className="object-cover" unoptimized />
                </div>
              ))
            ) : (
              <Folder className="mb-2 size-8 text-white/70" />
            )}
          </div>

          {/* Label bar — dark glass, anchored to the card's bottom edge,
              deliberately opaque-ish so it reads as a distinct "pocket"
              the previews tuck behind, matching the reference card. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex flex-col gap-2.5 rounded-b-2xl bg-black/55 px-3.5 py-3 backdrop-blur-md">
            <div className="flex items-start justify-between gap-2">
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
                  className="pointer-events-auto min-w-0 flex-1 truncate rounded bg-white/10 px-1 -mx-1 font-heading text-sm font-semibold text-white outline-none"
                />
              ) : (
                <p className="truncate font-heading text-sm font-semibold text-white">
                  {collection.name}
                </p>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`More options for ${collection.name}`}
                      className="pointer-events-auto flex size-5 shrink-0 items-center justify-center rounded-full text-white/60 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100 data-popup-open:opacity-100"
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
            <p className="text-[11px] text-white/60">
              {collection.count} {collection.count === 1 ? "save" : "saves"}
            </p>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {renderMenuActions(actions, ContextMenuItem, ContextMenuShortcut)}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Glass "folder" tiles for the reference app's Collections concept —
 * a lightweight, user-named grouping shown as a horizontal row above the
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
        <div className="glass-panel flex size-52 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl p-3">
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
          className="glass-panel flex size-52 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl text-sm text-muted-foreground transition-all hover:brightness-105"
        >
          <Plus className="size-5" />
          New collection
        </button>
      )}
    </div>
  );
}
