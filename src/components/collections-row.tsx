"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import useSWR from "swr";
import { animate } from "motion";
import { Folder, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type CollectionPreview = {
  id: string;
  name: string;
  slug: string;
  count: number;
  previews: string[];
};

// Spring timing + fan-out transforms adapted from jeetcreates.cc's
// Folder.tsx — imperative `animate()` calls on refs (not declarative
// whileHover props) deliberately, since animating a backdrop-filter
// element's transform via CSS/Motion's declarative path left a
// visible 360°-spin glitch on first hover there.
const OPEN_SPRING = { type: "spring", stiffness: 260, damping: 22 } as const;
const CLOSE_SPRING = { type: "spring", stiffness: 300, damping: 26 } as const;
const REST = [
  { x: 0, y: 0, rotate: -6 },
  { x: 0, y: 0, rotate: 0 },
  { x: 0, y: 0, rotate: 6 },
];
const OPEN_POS = [
  { x: -22, y: -10, rotate: -14 },
  { x: 0, y: -18, rotate: 0 },
  { x: 22, y: -10, rotate: 14 },
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

function FolderTile({ collection, active }: { collection: CollectionPreview; active: boolean }) {
  const tint = `glass-tint-${tintFor(collection.id)}`;
  const flapRef = useRef<HTMLDivElement>(null);
  const imgRefs = useRef<(HTMLDivElement | null)[]>([]);

  function open() {
    animate(flapRef.current!, { rotateX: -24 }, OPEN_SPRING);
    imgRefs.current.forEach((el, i) => {
      if (!el) return;
      const pos = OPEN_POS[i] ?? OPEN_POS[OPEN_POS.length - 1];
      animate(el, { x: pos.x, y: pos.y, rotate: pos.rotate }, OPEN_SPRING);
    });
  }

  function close() {
    animate(flapRef.current!, { rotateX: 0 }, CLOSE_SPRING);
    imgRefs.current.forEach((el, i) => {
      if (!el) return;
      const pos = REST[i] ?? REST[REST.length - 1];
      animate(el, { x: pos.x, y: pos.y, rotate: pos.rotate }, CLOSE_SPRING);
    });
  }

  return (
    <Link
      href={`/collections/${collection.slug}`}
      onPointerEnter={open}
      onPointerLeave={close}
      className={cn(
        "group relative flex h-28 w-44 shrink-0 flex-col overflow-visible rounded-xl [perspective:800px]",
        active && "ring-2 ring-primary",
      )}
    >
      {/* Static base: the "inside" of the folder, always present so the
          fanned previews have somewhere to sit even before hover.
          Positioning and glass-styling deliberately live on separate
          nodes — .glass-panel's (layered) `position: relative` otherwise
          beats an `absolute` utility on the same element under CSS
          cascade layers, leaving it stuck in normal flow. */}
      <div className="absolute inset-0">
        <div className={cn(tint, "flex h-full flex-col overflow-hidden rounded-xl")}>
          <div className="relative flex h-16 shrink-0 items-end justify-center overflow-hidden bg-black/5 pb-1 dark:bg-black/10">
            {collection.previews.length > 0 ? (
              collection.previews.slice(0, 3).map((src, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    imgRefs.current[i] = el;
                  }}
                  className="absolute size-11 overflow-hidden rounded-md border border-white/20 shadow-md will-change-transform"
                  style={{ transform: `translate(${REST[i]?.x ?? 0}px, ${REST[i]?.y ?? 0}px) rotate(${REST[i]?.rotate ?? 0}deg)` }}
                >
                  <Image src={src} alt="" fill className="object-cover" unoptimized />
                </div>
              ))
            ) : (
              <Folder className="mb-2 size-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1 px-3 py-2">
            <p className="truncate text-sm font-medium">{collection.name}</p>
            <p className="text-xs text-muted-foreground">{collection.count} saves</p>
          </div>
        </div>
      </div>
      {/* Flap: a glass "lid" that rotates up on hover to reveal the
          previews stacked beneath it. */}
      <div
        ref={flapRef}
        className="absolute inset-x-0 top-0 h-8 origin-top will-change-transform"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className={cn(tint, "h-full rounded-t-xl")} />
      </div>
    </Link>
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
    // near-zero sliver instead of its real ~7rem tile height.
    <div className="flex shrink-0 gap-3 overflow-x-auto px-6 pb-1 pt-6">
      {collections.map((c) => (
        <FolderTile key={c.id} collection={c} active={activeSlug === c.slug} />
      ))}

      {creating ? (
        <div className="glass-panel flex h-28 w-44 shrink-0 flex-col items-center justify-center gap-2 rounded-xl p-3">
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
          className="glass-panel flex h-28 w-44 shrink-0 flex-col items-center justify-center gap-2 rounded-xl text-sm text-muted-foreground transition-all hover:brightness-105"
        >
          <Plus className="size-5" />
          New collection
        </button>
      )}
    </div>
  );
}
