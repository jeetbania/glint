"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { FileText, CheckSquare, Link as LinkIcon, Minus, Plus, LocateFixed } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { CanvasToolbar } from "@/components/canvas-toolbar";
import {
  CanvasObjectToolbar,
  FONT_FAMILY_CSS,
  type CanvasObjectPatch,
} from "@/components/canvas-object-toolbar";
import { CanvasAlignToolbar, type AlignEdge, type DistributeAxis } from "@/components/canvas-align-toolbar";
import { CanvasExportDialog, type ExportBackground } from "@/components/canvas-export-dialog";
import { extractImageColors } from "@/lib/color-extraction-client";
import { cn } from "@/lib/utils";
import type { ApiItem, ItemType } from "@/types/item";
import type { ApiCanvasObject, CanvasObjectType, CanvasShapeVariant } from "@/types/canvas-object";
import { localFetch } from "@/lib/local/api";
import { useResolvedImageSrc, putBlob, localBlobRef } from "@/lib/local/blobs";

type Position = { x: number; y: number; w: number; h: number; zIndex: number };
type NodeRef = { kind: "item"; id: string } | { kind: "object"; id: string };

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const DEFAULT_W = 260;
const GRID_GAP = 28;
const CLICK_THRESHOLD = 4; // px of movement before a pointerdown counts as a drag, not a click
const MIN_NODE_SIZE = 60;
const MAX_HISTORY = 50;
const EXPORT_PADDING = 48;
const DRAG_TILT_MAX_DEG = 10; // clamp so a fast flick doesn't spin the card
const DRAG_TILT_SENSITIVITY = 2.5; // degrees per px of the latest movement step
const DRAG_TILT_EASE = 0.35; // per-frame lerp toward the target tilt — smooths out per-event noise

type UndoEntry =
  | { type: "position"; ref: NodeRef; before: Position; after: Position }
  | { type: "group-position"; refs: NodeRef[]; before: Position[]; after: Position[] }
  | { type: "object-create"; obj: ApiCanvasObject }
  | { type: "object-delete"; obj: ApiCanvasObject }
  | { type: "group-delete"; objs: ApiCanvasObject[] }
  | { type: "object-update"; id: string; before: CanvasObjectPatch; after: CanvasObjectPatch };

const SHAPE_SHORTCUT_KEYS: Record<string, CanvasShapeVariant> = {
  r: "rectangle",
  e: "ellipse",
  y: "triangle",
  l: "line",
  a: "arrow",
  b: "elbow-arrow",
};

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

function readImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  });
}

function rectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Default shape/geometry for each newly-placed canvas object, keyed off
 * the click point so it lands centered on the cursor. */
function defaultObjectFor(
  type: CanvasObjectType,
  cx: number,
  cy: number,
  zIndex: number,
  shapeVariant: CanvasShapeVariant = "rectangle",
) {
  switch (type) {
    case "sticky":
      return {
        type,
        text: "",
        x: cx - 110,
        y: cy - 110,
        w: 220,
        h: 220,
        zIndex,
        fill: "#FDE68A",
        textColor: "#3F3A0A",
        fontFamily: "sans" as const,
        fontSize: 14,
        align: "left" as const,
      };
    case "text":
      return {
        type,
        text: "",
        x: cx - 100,
        y: cy - 20,
        w: 220,
        h: 44,
        zIndex,
        textColor: "#17171A",
        fontFamily: "sans" as const,
        fontSize: 20,
        align: "left" as const,
      };
    case "shape": {
      const isStroke = shapeVariant === "line" || shapeVariant === "arrow" || shapeVariant === "elbow-arrow";
      // Straight line/arrow default to a thin horizontal strip (not a
      // corner-to-corner diagonal) — rotate the handle afterward to
      // angle it. Elbow-arrow keeps a real box since its bend needs
      // both dimensions to read at all.
      if (shapeVariant === "line" || shapeVariant === "arrow") {
        return {
          type,
          x: cx - 100,
          y: cy - 2,
          w: 200,
          h: 4,
          zIndex,
          fill: "#3B5BDB",
          shapeVariant,
        };
      }
      return {
        type,
        x: cx - 80,
        y: cy - 80,
        w: 160,
        h: 160,
        zIndex,
        fill: isStroke ? "#3B5BDB" : "#BFDBFE",
        shapeVariant,
      };
    }
    case "frame":
      return {
        type,
        text: "Frame",
        x: cx - 240,
        y: cy - 180,
        w: 480,
        h: 360,
        zIndex: -1000 - zIndex,
      };
  }
}

export function CollectionCanvas({
  items,
  positions: savedPositions,
  canvasObjects: initialCanvasObjects,
  collectionSlug,
  collectionName,
  onItemClick,
}: {
  items: ApiItem[];
  positions: Record<string, Position>;
  canvasObjects: ApiCanvasObject[];
  collectionSlug: string;
  collectionName: string;
  onItemClick: (itemId: string) => void;
}) {
  const { mutate } = useSWRConfig();

  // Canvas objects (sticky/text/shape/frame) are fully local, mutable
  // state — unlike items (edited elsewhere, refreshed via SWR), every
  // edit to these happens right here, so re-syncing from props on every
  // background revalidation would clobber in-flight edits. The parent
  // page keys this component by collectionSlug, so navigating to a
  // different collection remounts it with fresh initial state instead.
  const [canvasObjectsState, setCanvasObjectsState] = useState<ApiCanvasObject[]>(
    initialCanvasObjects,
  );

  const objectBasePositions = useMemo(() => {
    const out: Record<string, Position> = {};
    for (const o of canvasObjectsState) {
      out[o.id] = { x: o.x, y: o.y, w: o.w, h: o.h, zIndex: o.zIndex };
    }
    return out;
  }, [canvasObjectsState]);
  const basePositions = useMemo(
    () => ({ ...autoLayout(items), ...savedPositions, ...objectBasePositions }),
    [items, savedPositions, objectBasePositions],
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

  const kindById = useMemo(() => {
    const m = new Map<string, "item" | "object">();
    for (const it of items) m.set(it.id, "item");
    for (const o of canvasObjectsState) m.set(o.id, "object");
    return m;
  }, [items, canvasObjectsState]);
  function nodeRefById(id: string): NodeRef {
    return { kind: kindById.get(id) === "item" ? "item" : "object", id };
  }

  /** Every item/object whose center currently falls inside a frame's
   * bounds — recomputed on demand (not persisted), which is what lets
   * "drag the frame, its contents come along" work without a parent
   * field or any explicit reparenting step. Other frames are excluded
   * so frames never drag each other. */
  function getFrameContainedIds(framePos: Position, frameId: string): string[] {
    const ids: string[] = [];
    for (const it of items) {
      const p = positions[it.id];
      if (p && isCenterInside(p, framePos)) ids.push(it.id);
    }
    for (const o of canvasObjectsState) {
      if (o.id === frameId || o.type === "frame") continue;
      const p = positions[o.id];
      if (p && isCenterInside(p, framePos)) ids.push(o.id);
    }
    return ids;
  }
  function isCenterInside(pos: Position, container: Position): boolean {
    const cx = pos.x + pos.w / 2;
    const cy = pos.y + pos.h / 2;
    return (
      cx >= container.x &&
      cx <= container.x + container.w &&
      cy >= container.y &&
      cy <= container.y + container.h
    );
  }

  const [pan, setPan] = useState({ x: 80, y: 60 });
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);

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

  // -------------------------------------------------------------------
  // Selection + edit-mode state
  // -------------------------------------------------------------------
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingIdRef = useRef<string | null>(null);
  useEffect(() => {
    editingIdRef.current = editingId;
  }, [editingId]);

  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | HTMLInputElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pendingFocusId && textareaRefs.current[pendingFocusId]) {
      textareaRefs.current[pendingFocusId]?.focus();
      setPendingFocusId(null);
    }
  }, [pendingFocusId, canvasObjectsState]);

  const maxZ = useRef(items.length + canvasObjectsState.length + 1);
  const minZ = useRef(-2000);

  // Space-held → pan (matches Figma/FigJam convention). Marquee-select is
  // the default empty-space drag gesture otherwise (see task below).
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false);
  useEffect(() => {
    spaceHeldRef.current = spaceHeld;
  }, [spaceHeld]);

  // -------------------------------------------------------------------
  // Undo / redo
  // -------------------------------------------------------------------
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);

  function pushUndo(entry: UndoEntry) {
    setUndoStack((prev) => [...prev.slice(-MAX_HISTORY + 1), entry]);
    setRedoStack([]);
  }

  function persistPosition(ref: NodeRef, pos: Position) {
    const url =
      ref.kind === "item"
        ? `/api/collections/${collectionSlug}/items/${ref.id}`
        : `/api/collections/${collectionSlug}/canvas-objects/${ref.id}`;
    void localFetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pos),
    });
  }

  async function createObjectOnServer(input: Record<string, unknown>): Promise<ApiCanvasObject> {
    const res = await localFetch(`/api/collections/${collectionSlug}/canvas-objects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error("Failed to create canvas object");
    const data = await res.json();
    return data.canvasObject as ApiCanvasObject;
  }

  async function recreateObjectOnServer(obj: ApiCanvasObject): Promise<ApiCanvasObject> {
    const { id: _id, collectionId: _cid, createdAt: _ca, updatedAt: _ua, ...input } = obj;
    return createObjectOnServer(input);
  }

  async function applyUndoEntry(entry: UndoEntry) {
    if (entry.type === "position") {
      setPositions((prev) => ({ ...prev, [entry.ref.id]: entry.before }));
      persistPosition(entry.ref, entry.before);
    } else if (entry.type === "group-position") {
      setPositions((prev) => {
        const next = { ...prev };
        entry.refs.forEach((r, i) => {
          next[r.id] = entry.before[i];
        });
        return next;
      });
      entry.refs.forEach((r, i) => persistPosition(r, entry.before[i]));
    } else if (entry.type === "object-update") {
      setCanvasObjectsState((prev) =>
        prev.map((o) => (o.id === entry.id ? { ...o, ...entry.before } : o)),
      );
      void localFetch(`/api/collections/${collectionSlug}/canvas-objects/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.before),
      });
    } else if (entry.type === "object-create") {
      setCanvasObjectsState((prev) => prev.filter((o) => o.id !== entry.obj.id));
      setPositions((prev) => {
        const next = { ...prev };
        delete next[entry.obj.id];
        return next;
      });
      setSelectedIds((prev) => prev.filter((id) => id !== entry.obj.id));
      void localFetch(`/api/collections/${collectionSlug}/canvas-objects/${entry.obj.id}`, {
        method: "DELETE",
      });
    } else if (entry.type === "object-delete") {
      const created = await recreateObjectOnServer(entry.obj);
      entry.obj = created; // keep the entry pointing at the live id for a future redo/undo
      setCanvasObjectsState((prev) => [...prev, created]);
      setPositions((prev) => ({
        ...prev,
        [created.id]: { x: created.x, y: created.y, w: created.w, h: created.h, zIndex: created.zIndex },
      }));
    } else if (entry.type === "group-delete") {
      const created = await Promise.all(entry.objs.map((o) => recreateObjectOnServer(o)));
      entry.objs = created;
      setCanvasObjectsState((prev) => [...prev, ...created]);
      setPositions((prev) => {
        const next = { ...prev };
        for (const c of created) next[c.id] = { x: c.x, y: c.y, w: c.w, h: c.h, zIndex: c.zIndex };
        return next;
      });
    }
  }

  async function applyRedoEntry(entry: UndoEntry) {
    if (entry.type === "position") {
      setPositions((prev) => ({ ...prev, [entry.ref.id]: entry.after }));
      persistPosition(entry.ref, entry.after);
    } else if (entry.type === "group-position") {
      setPositions((prev) => {
        const next = { ...prev };
        entry.refs.forEach((r, i) => {
          next[r.id] = entry.after[i];
        });
        return next;
      });
      entry.refs.forEach((r, i) => persistPosition(r, entry.after[i]));
    } else if (entry.type === "object-update") {
      setCanvasObjectsState((prev) =>
        prev.map((o) => (o.id === entry.id ? { ...o, ...entry.after } : o)),
      );
      void localFetch(`/api/collections/${collectionSlug}/canvas-objects/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.after),
      });
    } else if (entry.type === "object-create") {
      const created = await recreateObjectOnServer(entry.obj);
      entry.obj = created;
      setCanvasObjectsState((prev) => [...prev, created]);
      setPositions((prev) => ({
        ...prev,
        [created.id]: { x: created.x, y: created.y, w: created.w, h: created.h, zIndex: created.zIndex },
      }));
    } else if (entry.type === "object-delete") {
      setCanvasObjectsState((prev) => prev.filter((o) => o.id !== entry.obj.id));
      setPositions((prev) => {
        const next = { ...prev };
        delete next[entry.obj.id];
        return next;
      });
      setSelectedIds((prev) => prev.filter((id) => id !== entry.obj.id));
      void localFetch(`/api/collections/${collectionSlug}/canvas-objects/${entry.obj.id}`, {
        method: "DELETE",
      });
    } else if (entry.type === "group-delete") {
      const ids = entry.objs.map((o) => o.id);
      setCanvasObjectsState((prev) => prev.filter((o) => !ids.includes(o.id)));
      setPositions((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      for (const id of ids) {
        void localFetch(`/api/collections/${collectionSlug}/canvas-objects/${id}`, { method: "DELETE" });
      }
    }
  }

  async function undo() {
    if (undoStack.length === 0) return;
    const entry = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    await applyUndoEntry(entry);
    setRedoStack((prev) => [...prev, entry]);
  }

  async function redo() {
    if (redoStack.length === 0) return;
    const entry = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    await applyRedoEntry(entry);
    setUndoStack((prev) => [...prev, entry]);
  }

  // -------------------------------------------------------------------
  // Delete the current selection — canvas objects are hard-deleted;
  // library items are only removed from THIS collection (they can live
  // in others / the Library itself, so a canvas delete shouldn't nuke
  // the underlying item).
  // -------------------------------------------------------------------
  async function handleDeleteSelection() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setSelectedIds([]);
    setEditingId(null);

    const objIds = ids.filter((id) => kindById.get(id) === "object");
    const itemIds = ids.filter((id) => kindById.get(id) === "item");

    if (objIds.length > 0) {
      const objs = objIds
        .map((id) => {
          const obj = canvasObjectsState.find((o) => o.id === id);
          const pos = positions[id];
          return obj && pos ? { ...obj, ...pos } : null;
        })
        .filter((o): o is ApiCanvasObject => !!o);
      setCanvasObjectsState((prev) => prev.filter((o) => !objIds.includes(o.id)));
      setPositions((prev) => {
        const next = { ...prev };
        for (const id of objIds) delete next[id];
        return next;
      });
      for (const id of objIds) {
        void localFetch(`/api/collections/${collectionSlug}/canvas-objects/${id}`, { method: "DELETE" });
      }
      if (objs.length > 1) pushUndo({ type: "group-delete", objs });
      else if (objs.length === 1) pushUndo({ type: "object-delete", obj: objs[0] });
    }

    if (itemIds.length > 0) {
      for (const id of itemIds) {
        const item = items.find((i) => i.id === id);
        if (!item) continue;
        const remaining = item.collections.filter((c) => c.slug !== collectionSlug).map((c) => c.name);
        void localFetch(`/api/items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collections: remaining }),
        });
      }
      await mutate(`/api/collections/${collectionSlug}`);
    }
  }

  // Keyboard shortcuts — skipped entirely while typing in a text field so
  // native undo/backspace inside a sticky note isn't hijacked.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const active = document.activeElement;
      const isTyping = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement;

      if (e.code === "Space" && !isTyping) {
        e.preventDefault();
        spaceHeldRef.current = true;
        setSpaceHeld(true);
        return;
      }
      if (e.key === "Escape") {
        setSelectedIds([]);
        setEditingId(null);
        return;
      }
      if (isTyping) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) void redo();
        else void undo();
        return;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && selectedIds.length > 0) {
        e.preventDefault();
        void handleDeleteSelection();
        return;
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const variant = SHAPE_SHORTCUT_KEYS[e.key.toLowerCase()];
        if (variant) {
          e.preventDefault();
          handleAddShape(variant);
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        spaceHeldRef.current = false;
        setSpaceHeld(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, undoStack, redoStack, canvasObjectsState, positions]);

  // -------------------------------------------------------------------
  // Background drag: marquee-select by default (drag from empty canvas
  // space to rubber-band select, like selecting files in Finder/Explorer)
  // — hold Space to pan-drag instead.
  // -------------------------------------------------------------------
  const bgDrag = useRef<{
    mode: "pan" | "marquee";
    startX: number;
    startY: number;
    origin: { x: number; y: number };
    additiveBase: string[];
    moved: boolean;
  } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );

  function onBackgroundPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-canvas-item]")) return;
    bgDrag.current = {
      mode: spaceHeldRef.current ? "pan" : "marquee",
      startX: e.clientX,
      startY: e.clientY,
      origin: panRef.current,
      additiveBase: e.shiftKey ? selectedIds : [],
      moved: false,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onBackgroundPointerMove(e: React.PointerEvent) {
    const drag = bgDrag.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) drag.moved = true;

    if (drag.mode === "pan") {
      setPan({ x: drag.origin.x + dx, y: drag.origin.y + dy });
      return;
    }

    const rect = viewportRef.current?.getBoundingClientRect();
    const ox = rect?.left ?? 0;
    const oy = rect?.top ?? 0;
    const x0 = drag.startX - ox;
    const y0 = drag.startY - oy;
    const x1 = e.clientX - ox;
    const y1 = e.clientY - oy;
    const screenRect = {
      x: Math.min(x0, x1),
      y: Math.min(y0, y1),
      w: Math.abs(x1 - x0),
      h: Math.abs(y1 - y0),
    };
    setMarqueeRect(screenRect);

    const canvasRect = {
      x: (screenRect.x - panRef.current.x) / zoomRef.current,
      y: (screenRect.y - panRef.current.y) / zoomRef.current,
      w: screenRect.w / zoomRef.current,
      h: screenRect.h / zoomRef.current,
    };
    const allIds = [...visibleItems.map((i) => i.id), ...canvasObjectsState.map((o) => o.id)];
    const hitIds = allIds.filter((id) => {
      const pos = positions[id];
      return pos && rectsIntersect(canvasRect, pos);
    });
    setSelectedIds(Array.from(new Set([...drag.additiveBase, ...hitIds])));
  }

  function onBackgroundPointerUp() {
    const drag = bgDrag.current;
    bgDrag.current = null;
    if (!drag) return;
    if (drag.mode === "marquee") {
      setMarqueeRect(null);
      if (!drag.moved) {
        setSelectedIds([]);
        setEditingId(null);
      }
    }
  }

  function viewportCenterCanvasCoords(): { x: number; y: number } {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (rect.width / 2 - panRef.current.x) / zoomRef.current,
      y: (rect.height / 2 - panRef.current.y) / zoomRef.current,
    };
  }

  async function createObjectAt(
    type: CanvasObjectType,
    cx: number,
    cy: number,
    shapeVariant?: CanvasShapeVariant,
  ) {
    const z = ++maxZ.current;
    const input = defaultObjectFor(type, cx, cy, z, shapeVariant);
    try {
      const created = await createObjectOnServer(input);
      setCanvasObjectsState((prev) => [...prev, created]);
      setPositions((prev) => ({
        ...prev,
        [created.id]: { x: created.x, y: created.y, w: created.w, h: created.h, zIndex: created.zIndex },
      }));
      setSelectedIds([created.id]);
      if (type === "sticky" || type === "text") {
        setEditingId(created.id);
        setPendingFocusId(created.id);
      }
      pushUndo({ type: "object-create", obj: created });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add that");
    }
  }

  // One-shot "add" actions — drop the new thing centered in the current
  // view immediately, no second click on the canvas required.
  function handleAddSticky() {
    const { x, y } = viewportCenterCanvasCoords();
    void createObjectAt("sticky", x, y);
  }
  function handleAddText() {
    const { x, y } = viewportCenterCanvasCoords();
    void createObjectAt("text", x, y);
  }
  function handleAddShape(variant: CanvasShapeVariant) {
    const { x, y } = viewportCenterCanvasCoords();
    void createObjectAt("shape", x, y, variant);
  }
  function handleAddFrame() {
    const { x, y } = viewportCenterCanvasCoords();
    void createObjectAt("frame", x, y);
  }

  // -------------------------------------------------------------------
  // Per-node drag (move a card/object, or the whole selection together
  // if the node being dragged is part of a multi-selection). Persisted
  // on release; a plain click (no movement) selects/opens/edits instead.
  // -------------------------------------------------------------------
  const nodeDrag = useRef<{
    refs: NodeRef[];
    primaryId: string;
    startX: number;
    startY: number;
    /** Updated on every raw pointermove event — always the freshest known
     * pointer position. */
    latestX: number;
    latestY: number;
    /** Updated only inside processDragFrame, once per animation frame —
     * the tilt step is measured against THIS, not the previous raw event,
     * so it reads as "distance moved since last frame" (a stable ~16ms
     * window) instead of "distance moved since last event" (noisy, since
     * events don't arrive at a fixed cadence). */
    frameX: number;
    /** Eased (lerped) tilt actually being painted — see DRAG_TILT_EASE. */
    currentTilt: number;
    tiltStarted: boolean;
    bases: Record<string, Position>;
    moved: boolean;
  } | null>(null);

  // Live DOM nodes for each item/object currently on the canvas, keyed by
  // id — lets the drag handlers below write position/tilt straight to the
  // element's inline style every animation frame instead of going through
  // setState, which would otherwise re-render every OTHER item/object on
  // the canvas too on every single pointermove (that full-subtree re-render
  // per event was the actual cause of the reported drag jitter — not the
  // tilt math itself). React state is only touched once at drag-start and
  // twice at drag-end (see onNodePointerUp), so the canvas stays cheap to
  // paint regardless of how many items it holds.
  const nodeElRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragRafRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (dragRafRef.current != null) cancelAnimationFrame(dragRafRef.current);
    };
  }, []);

  // Trello-card-style drag tilt — the dragged node(s) lean slightly toward
  // whichever way the mouse just moved. dragTilt holds the live angle per
  // node id — populated only at drag-start/drag-end now (see above), not
  // per-frame — and tiltingIds marks which ids should skip the CSS
  // transition (instant tracking while actively dragging) versus animate
  // smoothly back to 0 once released.
  const [dragTilt, setDragTilt] = useState<Record<string, number>>({});
  const [tiltingIds, setTiltingIds] = useState<string[]>([]);

  function onNodePointerDown(e: React.PointerEvent, ref: NodeRef) {
    // While actively editing this object's text, let clicks/drags behave
    // natively (caret placement, text selection) instead of moving it.
    if (ref.kind === "object" && editingIdRef.current === ref.id) return;

    const target = e.target as HTMLElement;
    // Block the browser's default mousedown->focus on a text field so a
    // first click can mean "select" without immediately jumping into
    // edit mode — see onNodePointerUp.
    e.preventDefault();
    e.stopPropagation();

    const isGroupMember = selectedIds.length > 1 && selectedIds.includes(ref.id);
    let refs = isGroupMember ? selectedIds.map(nodeRefById) : [ref];

    // Dragging a frame takes whatever's currently sitting inside it
    // along for the ride — computed fresh from current positions right
    // here (not a persisted parent relationship), so anything dropped
    // into the frame since is picked up automatically and nothing needs
    // reparenting when it's dragged back out.
    if (!isGroupMember && ref.kind === "object") {
      const obj = canvasObjectsState.find((o) => o.id === ref.id);
      const framePos = positions[ref.id];
      if (obj?.type === "frame" && framePos) {
        const contained = getFrameContainedIds(framePos, ref.id);
        if (contained.length > 0) refs = [ref, ...contained.map(nodeRefById)];
      }
    }

    const bases: Record<string, Position> = {};
    for (const r of refs) {
      const p = positions[r.id];
      if (p) bases[r.id] = p;
    }
    if (Object.keys(bases).length === 0) return;

    nodeDrag.current = {
      refs,
      primaryId: ref.id,
      startX: e.clientX,
      startY: e.clientY,
      latestX: e.clientX,
      latestY: e.clientY,
      frameX: e.clientX,
      currentTilt: 0,
      tiltStarted: false,
      bases,
      moved: false,
    };
    target.setPointerCapture(e.pointerId);
  }

  // Runs at most once per animation frame while a node drag is in
  // progress — reads the latest known pointer position (kept fresh by
  // onNodePointerMove on every raw event below) and writes position +
  // tilt straight to each dragged element's inline style via nodeElRefs,
  // bypassing setState entirely. That's what keeps a drag smooth
  // regardless of how many other items/objects are sitting on the
  // canvas — going through React state on every pointer event was
  // re-rendering the ENTIRE canvas (every item and object, not just the
  // one being dragged) on every single mouse-move tick, which is what
  // actually caused the reported jitter.
  function processDragFrame() {
    dragRafRef.current = null;
    const drag = nodeDrag.current;
    if (!drag || !drag.moved) return;

    const dx = (drag.latestX - drag.startX) / zoomRef.current;
    const dy = (drag.latestY - drag.startY) / zoomRef.current;
    for (const r of drag.refs) {
      const base = drag.bases[r.id];
      const el = nodeElRefs.current[r.id];
      if (base && el) {
        el.style.left = `${base.x + dx}px`;
        el.style.top = `${base.y + dy}px`;
      }
    }

    // Tilt toward the direction moved since the LAST PROCESSED FRAME (not
    // the last raw pointer event, which can arrive in irregular bursts) —
    // a quick flick tilts more than a slow drag, same as dragging a
    // physical card. Then eased toward that target instead of snapping
    // straight to it (DRAG_TILT_EASE), so a sudden reversal in direction
    // settles smoothly instead of flickering between two angles a single
    // frame apart.
    const stepDx = drag.latestX - drag.frameX;
    drag.frameX = drag.latestX;
    const targetTilt = Math.max(
      -DRAG_TILT_MAX_DEG,
      Math.min(DRAG_TILT_MAX_DEG, stepDx * DRAG_TILT_SENSITIVITY),
    );
    drag.currentTilt += (targetTilt - drag.currentTilt) * DRAG_TILT_EASE;
    const tiltStyle = Math.abs(drag.currentTilt) < 0.05 ? "" : `${drag.currentTilt}deg`;
    for (const r of drag.refs) {
      const el = nodeElRefs.current[r.id];
      if (el) el.style.rotate = tiltStyle;
    }

    // Keep the loop alive for the rest of the drag — needed so the eased
    // tilt keeps decaying toward its target even in the (common) case
    // where the pointer holds still for a moment mid-drag.
    dragRafRef.current = requestAnimationFrame(processDragFrame);
  }

  function onNodePointerMove(e: React.PointerEvent, ref: NodeRef) {
    const drag = nodeDrag.current;
    if (!drag || drag.primaryId !== ref.id) return;
    drag.latestX = e.clientX;
    drag.latestY = e.clientY;
    const dx = (e.clientX - drag.startX) / zoomRef.current;
    const dy = (e.clientY - drag.startY) / zoomRef.current;
    if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) drag.moved = true;
    if (drag.moved) {
      if (!drag.tiltStarted) {
        drag.tiltStarted = true;
        setTiltingIds(drag.refs.map((r) => r.id));
      }
      if (dragRafRef.current == null) {
        dragRafRef.current = requestAnimationFrame(processDragFrame);
      }
    }
  }

  function onNodePointerUp(e: React.PointerEvent, ref: NodeRef) {
    const drag = nodeDrag.current;
    nodeDrag.current = null;
    if (!drag || drag.primaryId !== ref.id) return;

    if (dragRafRef.current != null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }

    if (!drag.moved) {
      if (ref.kind === "item") {
        setSelectedIds([]);
        setEditingId(null);
        onItemClick(ref.id);
        return;
      }
      const obj = canvasObjectsState.find((o) => o.id === ref.id);
      const hasText = obj && (obj.type === "sticky" || obj.type === "text" || obj.type === "frame");
      const wasSelectedAlone = selectedIds.length === 1 && selectedIds[0] === ref.id;
      if (e.shiftKey) {
        setSelectedIds((prev) =>
          prev.includes(ref.id) ? prev.filter((id) => id !== ref.id) : [...prev, ref.id],
        );
        setEditingId(null);
      } else if (wasSelectedAlone && hasText) {
        setEditingId(ref.id);
        setPendingFocusId(ref.id);
      } else {
        setSelectedIds([ref.id]);
        setEditingId(null);
      }
      return;
    }

    // Hand the live tilt value back to React in two steps, one animation
    // frame apart. Step 1 (right now) syncs React's state to the exact
    // angle the element is already showing — transition still off, so
    // this paints identically to the current frame. Step 2 (next frame,
    // below) clears it with the transition back on, which is what
    // actually plays the settle-to-neutral animation instead of
    // snapping the tilt off instantly.
    const finalTilt = Math.abs(drag.currentTilt) < 0.05 ? 0 : drag.currentTilt;
    if (finalTilt !== 0) {
      setDragTilt((prev) => {
        const next = { ...prev };
        for (const r of drag.refs) next[r.id] = finalTilt;
        return next;
      });
    }
    requestAnimationFrame(() => {
      setTiltingIds([]);
      setDragTilt((prev) => {
        const next = { ...prev };
        for (const r of drag.refs) delete next[r.id];
        return next;
      });
    });

    const dx = (e.clientX - drag.startX) / zoomRef.current;
    const dy = (e.clientY - drag.startY) / zoomRef.current;
    const zBase = maxZ.current;
    const updates: Record<string, Position> = {};
    drag.refs.forEach((r, i) => {
      const base = drag.bases[r.id];
      updates[r.id] = { ...base, x: base.x + dx, y: base.y + dy, zIndex: zBase + i + 1 };
    });
    maxZ.current = zBase + drag.refs.length;
    setPositions((prev) => ({ ...prev, ...updates }));

    if (drag.refs.length > 1) {
      pushUndo({
        type: "group-position",
        refs: drag.refs,
        before: drag.refs.map((r) => drag.bases[r.id]),
        after: drag.refs.map((r) => updates[r.id]),
      });
    } else {
      pushUndo({ type: "position", ref: drag.refs[0], before: drag.bases[drag.refs[0].id], after: updates[drag.refs[0].id] });
    }
    for (const r of drag.refs) persistPosition(r, updates[r.id]);
  }

  // -------------------------------------------------------------------
  // Corner resize handles (single-selection canvas objects only).
  // -------------------------------------------------------------------
  const nodeResize = useRef<{
    ref: NodeRef;
    handle: "nw" | "ne" | "sw" | "se";
    startX: number;
    startY: number;
    base: Position;
  } | null>(null);

  function onResizeHandlePointerDown(
    e: React.PointerEvent,
    ref: NodeRef,
    handle: "nw" | "ne" | "sw" | "se",
  ) {
    e.stopPropagation();
    const pos = positions[ref.id];
    if (!pos) return;
    nodeResize.current = { ref, handle, startX: e.clientX, startY: e.clientY, base: pos };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onResizeHandlePointerMove(e: React.PointerEvent) {
    const r = nodeResize.current;
    if (!r) return;
    const dx = (e.clientX - r.startX) / zoomRef.current;
    const dy = (e.clientY - r.startY) / zoomRef.current;
    let { x, y, w, h } = r.base;
    if (r.handle.includes("e")) w = Math.max(MIN_NODE_SIZE, r.base.w + dx);
    if (r.handle.includes("s")) h = Math.max(MIN_NODE_SIZE, r.base.h + dy);
    if (r.handle.includes("w")) {
      w = Math.max(MIN_NODE_SIZE, r.base.w - dx);
      x = r.base.x + (r.base.w - w);
    }
    if (r.handle.includes("n")) {
      h = Math.max(MIN_NODE_SIZE, r.base.h - dy);
      y = r.base.y + (r.base.h - h);
    }
    setPositions((prev) => ({ ...prev, [r.ref.id]: { ...prev[r.ref.id], x, y, w, h } }));
  }
  function onResizeHandlePointerUp() {
    const r = nodeResize.current;
    nodeResize.current = null;
    if (!r) return;
    const finalPos = positions[r.ref.id];
    if (!finalPos) return;
    pushUndo({ type: "position", ref: r.ref, before: r.base, after: finalPos });
    persistPosition(r.ref, finalPos);
  }

  // -------------------------------------------------------------------
  // Rotate handle (single-selected canvas objects) — drag the handle
  // above the shape to spin it around its own center, Figma-style. Lines
  // default to perfectly horizontal on creation; this is how you angle
  // them afterward.
  // -------------------------------------------------------------------
  const nodeRotate = useRef<{
    id: string;
    centerX: number;
    centerY: number;
    startAngle: number;
    baseRotation: number;
  } | null>(null);

  function onRotateHandlePointerDown(e: React.PointerEvent, id: string, pos: Position, baseRotation: number) {
    e.stopPropagation();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + panRef.current.x + (pos.x + pos.w / 2) * zoomRef.current;
    const centerY = rect.top + panRef.current.y + (pos.y + pos.h / 2) * zoomRef.current;
    const startAngle = (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI;
    nodeRotate.current = { id, centerX, centerY, startAngle, baseRotation };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onRotateHandlePointerMove(e: React.PointerEvent) {
    const r = nodeRotate.current;
    if (!r) return;
    const angle = (Math.atan2(e.clientY - r.centerY, e.clientX - r.centerX) * 180) / Math.PI;
    let next = r.baseRotation + (angle - r.startAngle);
    // Snap near the 8 compass points — makes it easy to land on a clean
    // horizontal/vertical/45° angle instead of fighting the mouse.
    const nearest45 = Math.round(next / 45) * 45;
    if (Math.abs(next - nearest45) < 4) next = nearest45;
    setCanvasObjectsState((prev) =>
      prev.map((o) => (o.id === r.id ? { ...o, rotation: next } : o)),
    );
  }
  function onRotateHandlePointerUp() {
    const r = nodeRotate.current;
    nodeRotate.current = null;
    if (!r) return;
    const obj = canvasObjectsState.find((o) => o.id === r.id);
    if (!obj) return;
    pushUndo({
      type: "object-update",
      id: r.id,
      before: { rotation: r.baseRotation },
      after: { rotation: obj.rotation },
    });
    void localFetch(`/api/collections/${collectionSlug}/canvas-objects/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotation: obj.rotation }),
    });
  }

  // -------------------------------------------------------------------
  // Align / distribute / reorder the current multi-selection.
  // -------------------------------------------------------------------
  function getSelectedPositions(): { id: string; pos: Position }[] {
    return selectedIds
      .map((id) => ({ id, pos: positions[id] }))
      .filter((s): s is { id: string; pos: Position } => !!s.pos);
  }
  function commitGroupChange(sel: { id: string; pos: Position }[], updates: Record<string, Position>) {
    const refs = sel.map((s) => nodeRefById(s.id));
    setPositions((prev) => ({ ...prev, ...updates }));
    if (refs.length > 1) {
      pushUndo({
        type: "group-position",
        refs,
        before: sel.map((s) => s.pos),
        after: refs.map((r) => updates[r.id]),
      });
    }
    for (const r of refs) persistPosition(r, updates[r.id]);
  }
  function handleAlign(edge: AlignEdge) {
    const sel = getSelectedPositions();
    if (sel.length < 2) return;
    const minX = Math.min(...sel.map((s) => s.pos.x));
    const maxX = Math.max(...sel.map((s) => s.pos.x + s.pos.w));
    const minY = Math.min(...sel.map((s) => s.pos.y));
    const maxY = Math.max(...sel.map((s) => s.pos.y + s.pos.h));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const updates: Record<string, Position> = {};
    for (const { id, pos } of sel) {
      switch (edge) {
        case "left":
          updates[id] = { ...pos, x: minX };
          break;
        case "right":
          updates[id] = { ...pos, x: maxX - pos.w };
          break;
        case "center-h":
          updates[id] = { ...pos, x: centerX - pos.w / 2 };
          break;
        case "top":
          updates[id] = { ...pos, y: minY };
          break;
        case "bottom":
          updates[id] = { ...pos, y: maxY - pos.h };
          break;
        case "center-v":
          updates[id] = { ...pos, y: centerY - pos.h / 2 };
          break;
      }
    }
    commitGroupChange(sel, updates);
  }
  function handleDistribute(axis: DistributeAxis) {
    const sel = getSelectedPositions();
    if (sel.length < 3) {
      toast.error("Select at least 3 to distribute");
      return;
    }
    const updates: Record<string, Position> = {};
    if (axis === "horizontal") {
      const sorted = [...sel].sort((a, b) => a.pos.x - b.pos.x);
      const totalW = sorted.reduce((s, x) => s + x.pos.w, 0);
      const span = sorted[sorted.length - 1].pos.x + sorted[sorted.length - 1].pos.w - sorted[0].pos.x;
      const gap = (span - totalW) / (sorted.length - 1);
      let cursor = sorted[0].pos.x;
      for (const { id, pos } of sorted) {
        updates[id] = { ...pos, x: cursor };
        cursor += pos.w + gap;
      }
    } else {
      const sorted = [...sel].sort((a, b) => a.pos.y - b.pos.y);
      const totalH = sorted.reduce((s, x) => s + x.pos.h, 0);
      const span = sorted[sorted.length - 1].pos.y + sorted[sorted.length - 1].pos.h - sorted[0].pos.y;
      const gap = (span - totalH) / (sorted.length - 1);
      let cursor = sorted[0].pos.y;
      for (const { id, pos } of sorted) {
        updates[id] = { ...pos, y: cursor };
        cursor += pos.h + gap;
      }
    }
    commitGroupChange(sel, updates);
  }
  function handleBringToFront() {
    const sel = getSelectedPositions().sort((a, b) => a.pos.zIndex - b.pos.zIndex);
    if (sel.length === 0) return;
    const updates: Record<string, Position> = {};
    for (const { id, pos } of sel) updates[id] = { ...pos, zIndex: ++maxZ.current };
    commitGroupChange(sel, updates);
  }
  function handleSendToBack() {
    const sel = getSelectedPositions().sort((a, b) => a.pos.zIndex - b.pos.zIndex);
    if (sel.length === 0) return;
    const updates: Record<string, Position> = {};
    for (const { id, pos } of sel) updates[id] = { ...pos, zIndex: --minZ.current };
    commitGroupChange(sel, updates);
  }

  // -------------------------------------------------------------------
  // Canvas object content/style edits
  // -------------------------------------------------------------------
  const patchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const textEditStart = useRef<Record<string, string>>({});

  function schedulePatch(id: string, patch: CanvasObjectPatch) {
    clearTimeout(patchTimers.current[id]);
    patchTimers.current[id] = setTimeout(() => {
      void localFetch(`/api/collections/${collectionSlug}/canvas-objects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    }, 500);
  }

  function handleObjectTextFocus(id: string) {
    const obj = canvasObjectsState.find((o) => o.id === id);
    textEditStart.current[id] = obj?.text ?? "";
  }
  function handleObjectTextChange(id: string, text: string) {
    setCanvasObjectsState((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));
    schedulePatch(id, { text });
  }
  function handleObjectTextBlur(id: string) {
    const startVal = textEditStart.current[id];
    const obj = canvasObjectsState.find((o) => o.id === id);
    if (startVal !== undefined && obj && (obj.text ?? "") !== startVal) {
      pushUndo({ type: "object-update", id, before: { text: startVal }, after: { text: obj.text ?? "" } });
    }
    delete textEditStart.current[id];
    clearTimeout(patchTimers.current[id]);
    void localFetch(`/api/collections/${collectionSlug}/canvas-objects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: obj?.text ?? "" }),
    });
    setEditingId((cur) => (cur === id ? null : cur));
  }

  function handleObjectStyleChange(id: string, patch: CanvasObjectPatch) {
    const obj = canvasObjectsState.find((o) => o.id === id);
    if (!obj) return;
    const before: CanvasObjectPatch = {};
    for (const k of Object.keys(patch) as (keyof CanvasObjectPatch)[]) {
      (before as Record<string, unknown>)[k] = obj[k];
    }
    pushUndo({ type: "object-update", id, before, after: patch });
    setCanvasObjectsState((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    void localFetch(`/api/collections/${collectionSlug}/canvas-objects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  function handleDeleteObject(id: string) {
    const obj = canvasObjectsState.find((o) => o.id === id);
    if (!obj) return;
    const pos = positions[id];
    pushUndo({ type: "object-delete", obj: pos ? { ...obj, ...pos } : obj });
    setCanvasObjectsState((prev) => prev.filter((o) => o.id !== id));
    setPositions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
    void localFetch(`/api/collections/${collectionSlug}/canvas-objects/${id}`, { method: "DELETE" });
  }

  // -------------------------------------------------------------------
  // Add image — a one-shot action, not a persistent tool: pick a file,
  // upload it, save it as a real Library item, and place it centered on
  // the current view.
  // -------------------------------------------------------------------
  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Cancelable via the toast's own Cancel button, same as the paste/drop
    // capture path (use-capture-ingest.ts) — aborting the upload rejects
    // the surrounding Promise.all, which the catch below already handles.
    const controller = new AbortController();
    const toastId = toast.loading(`Adding ${file.name || "image"}…`, {
      cancel: { label: "Cancel", onClick: () => controller.abort() },
    });
    try {
      const [colors, dims, blobId] = await Promise.all([
        extractImageColors(file),
        readImageDimensions(file),
        putBlob(file, file.type),
      ]);
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");

      const createRes = await localFetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "image",
          blobUrl: localBlobRef(blobId),
          blobPathname: blobId,
          width: dims.width || undefined,
          height: dims.height || undefined,
          fileSizeBytes: file.size,
          mimeType: file.type,
          dominantColors: colors?.dominantColors ?? [],
          colorFamily: colors?.colorFamily ?? [],
        }),
      });
      if (!createRes.ok) throw new Error("Failed to save image");
      const { item } = await createRes.json();

      await localFetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collections: [collectionName] }),
      });

      const { x: cx, y: cy } = viewportCenterCanvasCoords();
      const ratio = dims.width && dims.height ? dims.width / dims.height : 4 / 3;
      const w = 280;
      const h = w / ratio;
      const z = ++maxZ.current;
      await localFetch(`/api/collections/${collectionSlug}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: cx - w / 2, y: cy - h / 2, w, h, zIndex: z }),
      });

      await mutate(`/api/collections/${collectionSlug}`);
      toast.success("Image added", { id: toastId });
    } catch (error) {
      if (controller.signal.aborted) {
        toast("Upload canceled", { id: toastId });
        return;
      }
      console.error(error);
      toast.error("Couldn't add image", { id: toastId });
    }
  }

  // -------------------------------------------------------------------
  // Export — cropped to fit all canvas content (not the current
  // viewport, not the infinite canvas), with a choice of transparent or
  // canvas-colored background.
  // -------------------------------------------------------------------
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  function computeContentBounds() {
    const ids = [...items.map((i) => i.id), ...canvasObjectsState.map((o) => o.id)];
    const boxes = ids.map((id) => positions[id]).filter((p): p is Position => !!p);
    if (boxes.length === 0) return null;
    return {
      minX: Math.min(...boxes.map((b) => b.x)),
      minY: Math.min(...boxes.map((b) => b.y)),
      maxX: Math.max(...boxes.map((b) => b.x + b.w)),
      maxY: Math.max(...boxes.map((b) => b.y + b.h)),
    };
  }

  async function handleExportConfirm(background: ExportBackground) {
    const bounds = computeContentBounds();
    const el = viewportRef.current;
    if (!bounds || !el) {
      toast.error("Nothing to export");
      return;
    }
    setExporting(true);

    const prevPan = panRef.current;
    const prevZoom = zoomRef.current;
    const prevSelected = selectedIds;
    setSelectedIds([]);
    setEditingId(null);

    const width = bounds.maxX - bounds.minX + EXPORT_PADDING * 2;
    const height = bounds.maxY - bounds.minY + EXPORT_PADDING * 2;
    setPan({ x: -bounds.minX + EXPORT_PADDING, y: -bounds.minY + EXPORT_PADDING });
    setZoom(1);

    const prevWidth = el.style.width;
    const prevHeight = el.style.height;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;

    try {
      // Two frames: one to let the state update commit, one for layout
      // to settle at the new size before we rasterize it.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const bg =
        background === "solid"
          ? getComputedStyle(document.documentElement).getPropertyValue("--background").trim() ||
            "#ffffff"
          : undefined;
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: bg,
        style: background === "transparent" ? { backgroundImage: "none" } : undefined,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${collectionSlug}-canvas.png`;
      a.click();
      setExportDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Couldn't export canvas");
    } finally {
      el.style.width = prevWidth;
      el.style.height = prevHeight;
      setPan(prevPan);
      setZoom(prevZoom);
      setSelectedIds(prevSelected);
      setExporting(false);
    }
  }

  const selectedObj =
    selectedIds.length === 1 ? canvasObjectsState.find((o) => o.id === selectedIds[0]) ?? null : null;
  const selectedObjPos = selectedObj ? positions[selectedObj.id] : null;

  const selectionBounds = useMemo(() => {
    if (selectedIds.length < 2) return null;
    const boxes = selectedIds.map((id) => positions[id]).filter((p): p is Position => !!p);
    if (boxes.length === 0) return null;
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [selectedIds, positions]);

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

      {/* Left tool dock */}
      <div className="pointer-events-none absolute left-4 top-1/2 z-20 -translate-y-1/2">
        <CanvasToolbar
          onSelectTool={() => {
            setSelectedIds([]);
            setEditingId(null);
          }}
          onAddImage={() => fileInputRef.current?.click()}
          onAddSticky={handleAddSticky}
          onAddText={handleAddText}
          onAddShape={handleAddShape}
          onAddFrame={handleAddFrame}
          onUndo={() => void undo()}
          onRedo={() => void redo()}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onExport={() => setExportDialogOpen(true)}
        />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleImageFileChange(e)}
      />

      <CanvasExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={(bg) => void handleExportConfirm(bg)}
        exporting={exporting}
      />

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

      {/* Floating rich toolbar for a single selected canvas object. */}
      {selectedObj && selectedObjPos && !exporting && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <CanvasObjectToolbar
            obj={selectedObj}
            onChange={(patch) => handleObjectStyleChange(selectedObj.id, patch)}
            onDelete={() => handleDeleteObject(selectedObj.id)}
            style={{
              position: "absolute",
              left: pan.x + (selectedObjPos.x + selectedObjPos.w / 2) * zoom,
              // Clamped so the toolbar never renders under the filter-chip
              // pill when the selection sits near the top of the view.
              top: Math.max(96, pan.y + selectedObjPos.y * zoom - 12),
              transform: "translate(-50%, -100%)",
            }}
          />
        </div>
      )}

      {/* Align/distribute toolbar for a multi-selection. */}
      {selectionBounds && !exporting && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <CanvasAlignToolbar
            onAlign={handleAlign}
            onDistribute={handleDistribute}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
            onDelete={() => void handleDeleteSelection()}
            style={{
              position: "absolute",
              left: pan.x + (selectionBounds.x + selectionBounds.w / 2) * zoom,
              top: Math.max(96, pan.y + selectionBounds.y * zoom - 12),
              transform: "translate(-50%, -100%)",
            }}
          />
        </div>
      )}

      {/* Marquee-select rectangle. */}
      {marqueeRect && (
        <div
          className="pointer-events-none absolute z-10 rounded-sm border border-primary/50 bg-primary/10"
          style={{ left: marqueeRect.x, top: marqueeRect.y, width: marqueeRect.w, height: marqueeRect.h }}
        />
      )}

      <div
        ref={viewportRef}
        className={cn(
          "dot-grid-bg h-full w-full touch-none",
          spaceHeld ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        )}
        style={{
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        }}
        onWheel={onWheel}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={(e) => {
          onBackgroundPointerMove(e);
          onResizeHandlePointerMove(e);
          onRotateHandlePointerMove(e);
        }}
        onPointerUp={() => {
          onBackgroundPointerUp();
          onResizeHandlePointerUp();
          onRotateHandlePointerUp();
        }}
      >
        <div
          className="relative origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {visibleItems.map((item) => {
            const pos = positions[item.id];
            if (!pos) return null;
            const ref: NodeRef = { kind: "item", id: item.id };
            const selected = selectedIds.includes(item.id);
            const tilt = dragTilt[item.id];
            const isTilting = tiltingIds.includes(item.id);
            return (
              <div
                key={item.id}
                ref={(el) => {
                  nodeElRefs.current[item.id] = el;
                }}
                data-canvas-item
                onPointerDown={(e) => onNodePointerDown(e, ref)}
                onPointerMove={(e) => onNodePointerMove(e, ref)}
                onPointerUp={(e) => onNodePointerUp(e, ref)}
                className={cn(
                  "absolute cursor-pointer touch-none select-none rounded-xl shadow-[0_4px_12px_-6px_rgba(0,0,0,0.2)]",
                  isTilting ? "transition-shadow" : "transition-[box-shadow,rotate] duration-300 ease-out",
                  "hover:shadow-[0_8px_18px_-8px_rgba(0,0,0,0.28)]",
                  selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: pos.w,
                  height: pos.h,
                  zIndex: pos.zIndex,
                  rotate: tilt ? `${tilt}deg` : undefined,
                }}
              >
                <CanvasItemBody item={item} />
              </div>
            );
          })}

          {canvasObjectsState.map((obj) => {
            const pos = positions[obj.id];
            if (!pos) return null;
            const ref: NodeRef = { kind: "object", id: obj.id };
            const selected = selectedIds.includes(obj.id);
            const showHandles = selected && selectedIds.length === 1;
            const tilt = dragTilt[obj.id];
            const isTilting = tiltingIds.includes(obj.id);
            return (
              <div
                key={obj.id}
                ref={(el) => {
                  nodeElRefs.current[obj.id] = el;
                }}
                data-canvas-item
                onPointerDown={(e) => onNodePointerDown(e, ref)}
                onPointerMove={(e) => onNodePointerMove(e, ref)}
                onPointerUp={(e) => onNodePointerUp(e, ref)}
                className={cn(
                  "absolute touch-none select-none",
                  obj.type === "frame" ? "cursor-default" : "cursor-pointer",
                  selected && !showHandles && "ring-2 ring-primary/70 ring-offset-2 ring-offset-background rounded-md",
                  !isTilting && "transition-[rotate] duration-300 ease-out",
                )}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: pos.w,
                  height: pos.h,
                  zIndex: pos.zIndex,
                  // obj.rotation (persisted, via the rotate handle) rides
                  // on `transform`; the temporary drag-tilt rides on the
                  // standalone `rotate` property instead — the two
                  // compose together rather than fighting over one
                  // property, so a rotated shape still tilts correctly
                  // mid-drag and settles back to its own true angle.
                  transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
                  rotate: tilt ? `${tilt}deg` : undefined,
                }}
              >
                <CanvasObjectBody
                  obj={obj}
                  textareaRef={(el) => {
                    textareaRefs.current[obj.id] = el;
                  }}
                  onTextFocus={() => handleObjectTextFocus(obj.id)}
                  onTextChange={(text) => handleObjectTextChange(obj.id, text)}
                  onTextBlur={() => handleObjectTextBlur(obj.id)}
                />
                {showHandles && (
                  <>
                    <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-foreground/40" />
                    {(["nw", "ne", "sw", "se"] as const).map((handle) => (
                      <div
                        key={handle}
                        onPointerDown={(e) => onResizeHandlePointerDown(e, ref, handle)}
                        className={cn(
                          "absolute size-3 rounded-full border-2 border-foreground bg-background shadow-sm",
                          handle === "nw" && "-left-1.5 -top-1.5 cursor-nwse-resize",
                          handle === "ne" && "-right-1.5 -top-1.5 cursor-nesw-resize",
                          handle === "sw" && "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                          handle === "se" && "-bottom-1.5 -right-1.5 cursor-nwse-resize",
                        )}
                      />
                    ))}
                    {/* Rotate handle — a stem below the bottom edge with
                        a grabbable circle at the end, Figma-style (kept
                        below rather than above so it never collides with
                        the floating style toolbar anchored above the
                        selection). Drag it to spin the shape about its
                        own center. */}
                    <div className="pointer-events-none absolute bottom-0 left-1/2 h-6 w-px translate-x-[-50%] translate-y-6 bg-foreground/40" />
                    <div
                      onPointerDown={(e) => onRotateHandlePointerDown(e, obj.id, pos, obj.rotation ?? 0)}
                      className="absolute bottom-0 left-1/2 size-3 translate-x-[-50%] translate-y-9 cursor-grab rounded-full border-2 border-foreground bg-background shadow-sm active:cursor-grabbing"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {exporting && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <span className="text-sm text-muted-foreground">Exporting…</span>
        </div>
      )}
    </div>
  );
}

function CanvasItemBody({ item }: { item: ApiItem }) {
  const resolvedBlobSrc = useResolvedImageSrc(item.type === "image" ? item.blobUrl : null);
  if (item.type === "image" && item.blobUrl) {
    if (!resolvedBlobSrc) return null;
    return (
      <Image
        src={resolvedBlobSrc}
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

function CanvasObjectBody({
  obj,
  textareaRef,
  onTextFocus,
  onTextChange,
  onTextBlur,
}: {
  obj: ApiCanvasObject;
  textareaRef: (el: HTMLTextAreaElement | HTMLInputElement | null) => void;
  onTextFocus: () => void;
  onTextChange: (text: string) => void;
  onTextBlur: () => void;
}) {
  const textStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY_CSS[obj.fontFamily],
    fontSize: obj.fontSize,
    fontWeight: obj.bold ? 700 : 400,
    fontStyle: obj.italic ? "italic" : "normal",
    textAlign: obj.align,
    color: obj.textColor ?? "#17171A",
  };

  if (obj.type === "sticky") {
    return (
      <div
        className="flex h-full w-full flex-col rounded-md p-3 shadow-[0_4px_12px_-6px_rgba(0,0,0,0.2)]"
        style={{ background: obj.fill ?? "#FDE68A" }}
      >
        <textarea
          ref={textareaRef}
          value={obj.text ?? ""}
          onFocus={onTextFocus}
          onChange={(e) => onTextChange(e.target.value)}
          onBlur={onTextBlur}
          placeholder="Type something"
          className="h-full w-full flex-1 resize-none border-none bg-transparent outline-none placeholder:text-black/35"
          style={textStyle}
        />
      </div>
    );
  }
  if (obj.type === "text") {
    return (
      <textarea
        ref={textareaRef}
        value={obj.text ?? ""}
        onFocus={onTextFocus}
        onChange={(e) => onTextChange(e.target.value)}
        onBlur={onTextBlur}
        placeholder="Type something"
        className="h-full w-full resize-none border-none bg-transparent outline-none placeholder:text-muted-foreground/50"
        style={textStyle}
      />
    );
  }
  if (obj.type === "shape") {
    const variant = obj.shapeVariant ?? "rectangle";
    if (variant === "rectangle" || variant === "ellipse") {
      return (
        <div
          className="h-full w-full shadow-[0_3px_10px_-6px_rgba(0,0,0,0.2)]"
          style={{
            background: obj.fill ?? "#BFDBFE",
            borderRadius: variant === "ellipse" ? "9999px" : 14,
          }}
        />
      );
    }
    if (variant === "triangle") {
      return (
        <div
          className="h-full w-full"
          style={{ background: obj.fill ?? "#BFDBFE", clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
        />
      );
    }
    // line / arrow / elbow-arrow — stroke-based, resized via the same
    // bounding-box corner handles every other object uses (dragging a
    // corner just redefines where the diagonal/elbow's endpoints fall).
    const stroke = obj.fill ?? "#3B5BDB";
    const markerId = `canvas-arrowhead-${obj.id}`;
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
        {variant !== "line" && (
          <defs>
            <marker id={markerId} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={stroke} />
            </marker>
          </defs>
        )}
        {variant === "elbow-arrow" ? (
          <path
            d="M2,2 L98,2 L98,98"
            fill="none"
            stroke={stroke}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            markerEnd={`url(#${markerId})`}
          />
        ) : (
          <line
            x1={2}
            y1={50}
            x2={98}
            y2={50}
            stroke={stroke}
            strokeWidth={3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            markerEnd={variant === "arrow" ? `url(#${markerId})` : undefined}
          />
        )}
      </svg>
    );
  }
  // frame
  return (
    <div
      className="relative h-full w-full overflow-visible rounded-lg border-2"
      style={{ borderColor: "rgba(120,120,130,0.35)", background: "rgba(120,120,130,0.04)" }}
    >
      <input
        ref={textareaRef}
        value={obj.text ?? ""}
        onFocus={onTextFocus}
        onChange={(e) => onTextChange(e.target.value)}
        onBlur={onTextBlur}
        placeholder="Frame"
        className="absolute -top-7 left-0 w-56 truncate border-none bg-transparent text-xs font-medium text-muted-foreground outline-none"
      />
    </div>
  );
}
