"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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

// Spring timing + fan-out transforms — imperative animate() calls on
// refs (not declarative whileHover props), matching jeetcreates.cc's own
// Folder.tsx, since animating transform via CSS/Motion's declarative
// path there left a visible glitch on first hover.
const OPEN_SPRING = { type: "spring", stiffness: 260, damping: 22 } as const;
const CLOSE_SPRING = { type: "spring", stiffness: 300, damping: 26 } as const;
const REST = [
  { x: -24, y: 6, rotate: -8 },
  { x: 0, y: -4, rotate: 0 },
  { x: 24, y: 6, rotate: 8 },
];
const OPEN_POS = [
  { x: -40, y: -6, rotate: -14 },
  { x: 0, y: -16, rotate: 0 },
  { x: 40, y: -6, rotate: 14 },
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
  const imgRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  return (
    <Link
      href={`/collections/${collection.slug}`}
      onPointerEnter={open}
      onPointerLeave={close}
      className="group relative h-32 w-48 shrink-0 [perspective:800px]"
    >
      {/* Card: pastel glass, anchored to the bottom — leaves room above
          for the fanned previews to peek out over its top edge, like the
          jeetcreates.cc project cards this is modeled on. */}
      <div
        className={cn(
          tint,
          "absolute inset-x-0 bottom-0 flex h-24 flex-col justify-end overflow-hidden rounded-2xl p-3",
          active && "ring-2 ring-primary",
        )}
      >
        <p className="truncate font-heading text-sm font-semibold tracking-heading">
          {collection.name}
        </p>
        <p className="text-xs text-white/70">{collection.count} saves</p>
      </div>

      {/* Fanned previews, peeking above the card's top edge. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-20 items-center justify-center">
        {collection.previews.length > 0 ? (
          collection.previews.slice(0, 3).map((src, i) => (
            <div
              key={i}
              ref={(el) => {
                imgRefs.current[i] = el;
              }}
              className="absolute size-20 overflow-hidden rounded-xl border border-white/25 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.5)] will-change-transform"
              style={{
                transform: `translate(${REST[i]?.x ?? 0}px, ${REST[i]?.y ?? 0}px) rotate(${REST[i]?.rotate ?? 0}deg)`,
              }}
            >
              <Image src={src} alt="" fill className="object-cover" unoptimized />
            </div>
          ))
        ) : (
          <Folder className="size-6 text-muted-foreground" />
        )}
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
    // near-zero sliver instead of its real tile height.
    <div className="flex shrink-0 items-end gap-4 overflow-x-auto px-6 pb-1 pt-8">
      {collections.map((c) => (
        <FolderTile key={c.id} collection={c} active={activeSlug === c.slug} />
      ))}

      {creating ? (
        <div className="glass-panel flex h-24 w-48 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl p-3">
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
          className="glass-panel flex h-24 w-48 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl text-sm text-muted-foreground transition-all hover:brightness-105"
        >
          <Plus className="size-5" />
          New collection
        </button>
      )}
    </div>
  );
}
