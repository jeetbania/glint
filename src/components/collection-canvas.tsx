"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { FileText, CheckSquare, Link as LinkIcon, Minus, Plus, LocateFixed } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ApiItem, ItemType } from "@/types/item";

type Position = { x: number; y: number; w: number; h: number; zIndex: number };

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const DEFAULT_W = 260;
const GRID_GAP = 28;
const CLICK_THRESHOLD = 4; // px of movement before a pointerdown counts as a drag, not a click

/** Auto-arranges any item with no saved position into a simple grid, so a
 * fresh collection isn't a blank canvas — positions are only written to
 * the DB once the user actually drags a card (see onDragEnd). */
function autoLayout(items: ApiItem[]): Record<string, Position> {
  const cols = 5;
  const out: Record<string, Position> = {};
  items.forEach((item, i) => {
    const ratio = item.width && item.height ? item.width / item.height : 4 / 3;
    const w = DEFAULT_W;
    const h = item.type === "image" || item.type === "link" ? w / ratio : 160;
    const col = i % cols;
    const row = Math.floor(i / cols);
    out[item.id] = {
      x: col * (DEFAULT_W + GRID_GAP),
      y: row * (220 + GRID_GAP),
      w,
      h,
      zIndex: i,
    };
  });
  return out;
}

export function CollectionCanvas({
  items,
  positions: savedPositions,
  collectionSlug,
  onItemClick,
}: {
  items: ApiItem[];
  positions: Record<string, Position>;
  collectionSlug: string;
  onItemClick: (itemId: string) => void;
}) {
  // Base layout: saved DB positions win, anything without one falls back
  // to an auto-arranged grid slot. `overrides` holds anything actively
  // (or just-finished) being dragged locally, so a drag never snaps back
  // while waiting on the PATCH + SWR revalidation round-trip.
  const basePositions = useMemo(
    () => ({ ...autoLayout(items), ...savedPositions }),
    [items, savedPositions],
  );
  const [overrides, setOverrides] = useState<Record<string, Position>>({});
  const positions = useMemo(
    () => ({ ...basePositions, ...overrides }),
    [basePositions, overrides],
  );
  const setPositions = setOverrides;

  const [typeFilter, setTypeFilter] = useState<"all" | ItemType>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const availableTags = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      for (const tag of item.tags) map.set(tag.slug, tag.name);
    }
    return [...map.entries()].map(([slug, name]) => ({ slug, name }));
  }, [items]);

  const visibleItems = items.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (tagFilter && !item.tags.some((t) => t.slug === tagFilter)) return false;
    return true;
  });

  const [pan, setPan] = useState({ x: 80, y: 60 });
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Mirrored into refs (via effect, not during render) so event handlers
  // registered once via useCallback can always read the latest pan/zoom
  // without needing to be re-created every time either changes.
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const zoomAt = useCallback((clientX: number, clientY: number, nextZoomRaw: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoomRaw));
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const worldX = (px - panRef.current.x) / zoomRef.current;
    const worldY = (py - panRef.current.y) / zoomRef.current;
    setPan({ x: px - worldX * nextZoom, y: py - worldY * nextZoom });
    setZoom(nextZoom);
  }, []);

  // Wheel: plain scroll pans (matches standard trackpad/mouse-wheel
  // canvas behavior); Cmd/Ctrl+scroll zooms, centered on the cursor.
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * 0.0015);
        zoomAt(e.clientX, e.clientY, zoomRef.current * factor);
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    },
    [zoomAt],
  );

  // Background pan-drag (click-drag empty canvas space to pan).
  const panDrag = useRef<{ startX: number; startY: number; origin: { x: number; y: number } } | null>(null);
  const onBackgroundPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-canvas-item]")) return;
    panDrag.current = { startX: e.clientX, startY: e.clientY, origin: panRef.current };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onBackgroundPointerMove = useCallback((e: React.PointerEvent) => {
    if (!panDrag.current) return;
    const { startX, startY, origin } = panDrag.current;
    setPan({ x: origin.x + (e.clientX - startX), y: origin.y + (e.clientY - startY) });
  }, []);
  const onBackgroundPointerUp = useCallback(() => {
    panDrag.current = null;
  }, []);

  // Per-item drag (move a card on the canvas, persisted on release).
  const itemDrag = useRef<{
    id: string;
    startX: number;
    startY: number;
    base: Position;
    moved: boolean;
  } | null>(null);
  const maxZ = useRef(items.length + 1);

  const onItemPointerDown = useCallback(
    (e: React.PointerEvent, item: ApiItem) => {
      e.stopPropagation();
      const pos = positions[item.id];
      if (!pos) return;
      itemDrag.current = {
        id: item.id,
        startX: e.clientX,
        startY: e.clientY,
        base: pos,
        moved: false,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [positions],
  );

  const onItemPointerMove = useCallback(
    (e: React.PointerEvent, item: ApiItem) => {
      const drag = itemDrag.current;
      if (!drag || drag.id !== item.id) return;
      const dx = (e.clientX - drag.startX) / zoomRef.current;
      const dy = (e.clientY - drag.startY) / zoomRef.current;
      if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) {
        drag.moved = true;
      }
      if (drag.moved) {
        setPositions((prev) => ({
          ...prev,
          [item.id]: { ...drag.base, x: drag.base.x + dx, y: drag.base.y + dy },
        }));
      }
    },
    [setPositions],
  );

  const onItemPointerUp = useCallback(
    (e: React.PointerEvent, item: ApiItem) => {
      const drag = itemDrag.current;
      itemDrag.current = null;
      if (!drag || drag.id !== item.id) return;
      if (!drag.moved) {
        onItemClick(item.id);
        return;
      }
      const nextZ = ++maxZ.current;
      const finalPos = { ...positions[item.id], zIndex: nextZ };
      setPositions((prev) => ({ ...prev, [item.id]: finalPos }));
      void fetch(`/api/collections/${collectionSlug}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPos),
      });
    },
    [collectionSlug, onItemClick, positions, setPositions],
  );

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Floating filter chips — scoped to this collection only, and
          replace the old top-nav "Boards" concept entirely. Positioning
          and glass-styling live on separate nodes: .glass-pill's
          (layered) `position: relative` otherwise beats an `absolute`
          utility on the same element under CSS cascade layers. */}
      <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2">
      <div className="glass-pill pointer-events-auto flex items-center gap-1 p-1">
        <Tabs
          glass={false}
          items={(["all", "image", "link", "note", "task"] as const).map((t) => ({
            value: t,
            label: t === "all" ? "All" : `${t}s`,
          }))}
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as typeof typeFilter)}
        />
        {availableTags.length > 0 && (
          <>
            <span className="mx-1 h-4 w-px bg-border" />
            {availableTags.slice(0, 6).map((t) => (
              <button
                key={t.slug}
                onClick={() => setTagFilter((cur) => (cur === t.slug ? null : t.slug))}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  tagFilter === t.slug
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.name}
              </button>
            ))}
          </>
        )}
      </div>
      </div>

      {/* Zoom controls */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-20">
      <div className="glass-pill pointer-events-auto flex items-center gap-1 p-1">
        <button
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => {
            const rect = viewportRef.current?.getBoundingClientRect();
            if (rect) zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, zoom * 0.85);
          }}
          aria-label="Zoom out"
        >
          <Minus className="size-3.5" />
        </button>
        <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => {
            const rect = viewportRef.current?.getBoundingClientRect();
            if (rect) zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, zoom * 1.15);
          }}
          aria-label="Zoom in"
        >
          <Plus className="size-3.5" />
        </button>
        <span className="mx-0.5 h-4 w-px bg-border" />
        <button
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => {
            setPan({ x: 80, y: 60 });
            setZoom(1);
          }}
          aria-label="Reset view"
        >
          <LocateFixed className="size-3.5" />
        </button>
      </div>
      </div>

      <div
        ref={viewportRef}
        className="dot-grid-bg h-full w-full cursor-grab touch-none active:cursor-grabbing"
        style={{
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        }}
        onWheel={onWheel}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onBackgroundPointerMove}
        onPointerUp={onBackgroundPointerUp}
      >
        <div
          className="relative origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {visibleItems.map((item) => {
            const pos = positions[item.id];
            if (!pos) return null;
            return (
              <div
                key={item.id}
                data-canvas-item
                onPointerDown={(e) => onItemPointerDown(e, item)}
                onPointerMove={(e) => onItemPointerMove(e, item)}
                onPointerUp={(e) => onItemPointerUp(e, item)}
                className="absolute cursor-pointer touch-none select-none rounded-xl shadow-[0_10px_28px_-10px_rgba(0,0,0,0.5)] transition-shadow hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)]"
                style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h, zIndex: pos.zIndex }}
              >
                <CanvasItemBody item={item} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CanvasItemBody({ item }: { item: ApiItem }) {
  if (item.type === "image" && item.blobUrl) {
    return (
      <Image
        src={item.blobUrl}
        alt={item.title ?? "Saved image"}
        fill
        sizes="400px"
        className="rounded-xl object-cover"
        unoptimized
        draggable={false}
      />
    );
  }
  if (item.type === "link" && item.previewImageUrl) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-xl bg-muted">
        <Image
          src={item.previewImageUrl}
          alt=""
          fill
          sizes="400px"
          className="object-cover"
          unoptimized
          draggable={false}
        />
        <div className="absolute left-2 top-2 flex max-w-[80%] items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 backdrop-blur-sm">
          <LinkIcon className="size-3 shrink-0 text-white" />
          <span className="truncate text-[11px] font-medium text-white">
            {item.domain ?? item.url}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="glass-panel flex h-full w-full flex-col gap-1.5 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {item.type === "note" ? (
          <FileText className="size-3.5" />
        ) : item.type === "task" ? (
          <CheckSquare className="size-3.5" />
        ) : (
          <LinkIcon className="size-3.5" />
        )}
        {item.type}
      </div>
      <p className="line-clamp-2 text-sm font-medium">{item.title ?? item.url}</p>
      {item.bodyText && (
        <p className="line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
          {item.bodyText}
        </p>
      )}
    </div>
  );
}
