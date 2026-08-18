"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { FileText, CheckSquare, Link as LinkIcon, Minus, Plus, LocateFixed } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { CanvasToolbar, type CanvasTool } from "@/components/canvas-toolbar";
import {
  CanvasObjectToolbar,
  FONT_FAMILY_CSS,
  type CanvasObjectPatch,
} from "@/components/canvas-object-toolbar";
import { extractImageColors } from "@/lib/color-extraction-client";
import { cn } from "@/lib/utils";
import type { ApiItem, ItemType } from "@/types/item";
import type { ApiCanvasObject, CanvasObjectType } from "@/types/canvas-object";

type Position = { x: number; y: number; w: number; h: number; zIndex: number };
type NodeRef = { kind: "item"; id: string } | { kind: "object"; id: string };

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const DEFAULT_W = 260;
const GRID_GAP = 28;
const CLICK_THRESHOLD = 4; // px of movement before a pointerdown counts as a drag, not a click
const MIN_NODE_SIZE = 60;
const MAX_HISTORY = 50;

type UndoEntry =
  | { type: "position"; ref: NodeRef; before: Position; after: Position }
  | { type: "object-create"; obj: ApiCanvasObject }
  | { type: "object-delete"; obj: ApiCanvasObject }
  | { type: "object-update"; id: string; before: CanvasObjectPatch; after: CanvasObjectPatch };

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

/** Default shape/geometry for each newly-placed canvas object, keyed off
 * the click point so it lands centered on the cursor. */
function defaultObjectFor(
  type: CanvasObjectType,
  cx: number,
  cy: number,
  zIndex: number,
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
    case "shape":
      return {
        type,
        x: cx - 80,
        y: cy - 80,
        w: 160,
        h: 160,
        zIndex,
        fill: "#BFDBFE",
        shapeVariant: "rectangle" as const,
      };
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

  // Base layout: saved DB positions win, anything without one falls back
  // to an auto-arranged grid slot (items) or its creation spot (objects).
  // `overrides` holds anything actively (or just-finished) being
  // dragged/resized locally, so a drag never snaps back while waiting on
  // the PATCH + SWR revalidation round-trip.
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

  // -------------------------------------------------------------------
  // Tool + selection state
  // -------------------------------------------------------------------
  const [tool, setTool] = useState<CanvasTool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    void fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pos),
    });
  }

  async function createObjectOnServer(input: Record<string, unknown>): Promise<ApiCanvasObject> {
    const res = await fetch(`/api/collections/${collectionSlug}/canvas-objects`, {
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
    } else if (entry.type === "object-update") {
      setCanvasObjectsState((prev) =>
        prev.map((o) => (o.id === entry.id ? { ...o, ...entry.before } : o)),
      );
      void fetch(`/api/collections/${collectionSlug}/canvas-objects/${entry.id}`, {
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
      if (selectedId === entry.obj.id) setSelectedId(null);
      void fetch(`/api/collections/${collectionSlug}/canvas-objects/${entry.obj.id}`, {
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
    }
  }

  async function applyRedoEntry(entry: UndoEntry) {
    if (entry.type === "position") {
      setPositions((prev) => ({ ...prev, [entry.ref.id]: entry.after }));
      persistPosition(entry.ref, entry.after);
    } else if (entry.type === "object-update") {
      setCanvasObjectsState((prev) =>
        prev.map((o) => (o.id === entry.id ? { ...o, ...entry.after } : o)),
      );
      void fetch(`/api/collections/${collectionSlug}/canvas-objects/${entry.id}`, {
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
      if (selectedId === entry.obj.id) setSelectedId(null);
      void fetch(`/api/collections/${collectionSlug}/canvas-objects/${entry.obj.id}`, {
        method: "DELETE",
      });
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

  // Keyboard shortcuts — skipped entirely while typing in a text field so
  // native undo/backspace inside a sticky note isn't hijacked.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const active = document.activeElement;
      const isTyping = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement;
      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }
      if (isTyping) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) void redo();
        else void undo();
        return;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && selectedId) {
        e.preventDefault();
        handleDeleteObject(selectedId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, undoStack, redoStack]);

  // -------------------------------------------------------------------
  // Background pan-drag (click-drag empty canvas space to pan) — also
  // where a click while a placement tool is active drops a new object.
  // -------------------------------------------------------------------
  const panDrag = useRef<{
    startX: number;
    startY: number;
    origin: { x: number; y: number };
    moved: boolean;
  } | null>(null);

  const onBackgroundPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-canvas-item]")) return;
    panDrag.current = { startX: e.clientX, startY: e.clientY, origin: panRef.current, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onBackgroundPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = panDrag.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) drag.moved = true;
    setPan({ x: drag.origin.x + dx, y: drag.origin.y + dy });
  }, []);
  const onBackgroundPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = panDrag.current;
      panDrag.current = null;
      if (!drag) return;
      if (!drag.moved && tool !== "select") {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (rect) {
          const cx = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
          const cy = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
          void createObjectAt(tool, cx, cy);
        }
        setTool("select");
      } else if (!drag.moved) {
        setSelectedId(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tool],
  );

  async function createObjectAt(type: CanvasObjectType, cx: number, cy: number) {
    const z = ++maxZ.current;
    const input = defaultObjectFor(type, cx, cy, z);
    try {
      const created = await createObjectOnServer(input);
      setCanvasObjectsState((prev) => [...prev, created]);
      setPositions((prev) => ({
        ...prev,
        [created.id]: { x: created.x, y: created.y, w: created.w, h: created.h, zIndex: created.zIndex },
      }));
      setSelectedId(created.id);
      setPendingFocusId(created.id);
      pushUndo({ type: "object-create", obj: created });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add that");
    }
  }

  // -------------------------------------------------------------------
  // Per-node drag (move a card/object on the canvas, persisted on
  // release). Shared between items and canvas objects — the only branch
  // is what a plain click (no movement) does.
  // -------------------------------------------------------------------
  const nodeDrag = useRef<{
    ref: NodeRef;
    startX: number;
    startY: number;
    base: Position;
    moved: boolean;
  } | null>(null);

  const onNodePointerDown = useCallback(
    (e: React.PointerEvent, ref: NodeRef) => {
      // Let clicks/drags inside an editable field behave natively (text
      // selection, caret placement) instead of moving the whole node —
      // selection is instead driven by the field's own onFocus.
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
      e.stopPropagation();
      const pos = positions[ref.id];
      if (!pos) return;
      nodeDrag.current = { ref, startX: e.clientX, startY: e.clientY, base: pos, moved: false };
      target.setPointerCapture(e.pointerId);
    },
    [positions],
  );

  const onNodePointerMove = useCallback(
    (e: React.PointerEvent, ref: NodeRef) => {
      const drag = nodeDrag.current;
      if (!drag || drag.ref.id !== ref.id) return;
      const dx = (e.clientX - drag.startX) / zoomRef.current;
      const dy = (e.clientY - drag.startY) / zoomRef.current;
      if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) {
        drag.moved = true;
      }
      if (drag.moved) {
        setPositions((prev) => ({
          ...prev,
          [ref.id]: { ...drag.base, x: drag.base.x + dx, y: drag.base.y + dy },
        }));
      }
    },
    [setPositions],
  );

  const onNodePointerUp = useCallback(
    (e: React.PointerEvent, ref: NodeRef) => {
      const drag = nodeDrag.current;
      nodeDrag.current = null;
      if (!drag || drag.ref.id !== ref.id) return;
      if (!drag.moved) {
        if (ref.kind === "item") onItemClick(ref.id);
        else setSelectedId(ref.id);
        return;
      }
      const nextZ = ++maxZ.current;
      const finalPos = { ...positions[ref.id], zIndex: nextZ };
      setPositions((prev) => ({ ...prev, [ref.id]: finalPos }));
      pushUndo({ type: "position", ref, before: drag.base, after: finalPos });
      persistPosition(ref, finalPos);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collectionSlug, onItemClick, positions],
  );

  // -------------------------------------------------------------------
  // Corner resize handles (canvas objects only).
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
  // Canvas object content/style edits
  // -------------------------------------------------------------------
  const patchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const textEditStart = useRef<Record<string, string>>({});

  function schedulePatch(id: string, patch: CanvasObjectPatch) {
    clearTimeout(patchTimers.current[id]);
    patchTimers.current[id] = setTimeout(() => {
      void fetch(`/api/collections/${collectionSlug}/canvas-objects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    }, 500);
  }

  function handleObjectTextFocus(id: string) {
    setSelectedId(id);
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
    void fetch(`/api/collections/${collectionSlug}/canvas-objects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: obj?.text ?? "" }),
    });
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
    void fetch(`/api/collections/${collectionSlug}/canvas-objects/${id}`, {
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
    if (selectedId === id) setSelectedId(null);
    void fetch(`/api/collections/${collectionSlug}/canvas-objects/${id}`, { method: "DELETE" });
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
    const toastId = toast.loading(`Adding ${file.name || "image"}…`);
    try {
      const [colors, dims, blob] = await Promise.all([
        extractImageColors(file),
        readImageDimensions(file),
        upload(file.name || `canvas-${Date.now()}.png`, file, {
          access: "public",
          handleUploadUrl: "/api/blob/upload-token",
        }),
      ]);

      const createRes = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "image",
          blobUrl: blob.url,
          blobPathname: blob.pathname,
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

      await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collections: [collectionName] }),
      });

      const rect = viewportRef.current?.getBoundingClientRect();
      const cx = rect ? (rect.width / 2 - panRef.current.x) / zoomRef.current : 0;
      const cy = rect ? (rect.height / 2 - panRef.current.y) / zoomRef.current : 0;
      const ratio = dims.width && dims.height ? dims.width / dims.height : 4 / 3;
      const w = 280;
      const h = w / ratio;
      const z = ++maxZ.current;
      await fetch(`/api/collections/${collectionSlug}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: cx - w / 2, y: cy - h / 2, w, h, zIndex: z }),
      });

      await mutate(`/api/collections/${collectionSlug}`);
      toast.success("Image added", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Couldn't add image", { id: toastId });
    }
  }

  // -------------------------------------------------------------------
  // Export current view as PNG
  // -------------------------------------------------------------------
  const [exporting, setExporting] = useState(false);
  async function handleExport() {
    if (!viewportRef.current) return;
    setExporting(true);
    const wasSelected = selectedId;
    setSelectedId(null); // hide selection chrome/handles from the export
    try {
      await new Promise((r) => requestAnimationFrame(r));
      const dataUrl = await toPng(viewportRef.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${collectionSlug}-canvas.png`;
      a.click();
    } catch (error) {
      console.error(error);
      toast.error("Couldn't export canvas");
    } finally {
      setExporting(false);
      setSelectedId(wasSelected);
    }
  }

  const selectedObj = canvasObjectsState.find((o) => o.id === selectedId) ?? null;
  const selectedObjPos = selectedObj ? positions[selectedObj.id] : null;

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
          tool={tool}
          onToolChange={(t) => setTool((cur) => (cur === t ? "select" : t))}
          onAddImage={() => fileInputRef.current?.click()}
          onUndo={() => void undo()}
          onRedo={() => void redo()}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onExport={() => void handleExport()}
          exporting={exporting}
        />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleImageFileChange(e)}
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

      {/* Floating rich toolbar for the selected canvas object — screen
          space, computed from pan/zoom rather than living inside the
          scaled content layer so it never grows/shrinks with zoom. */}
      {selectedObj && selectedObjPos && !exporting && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <CanvasObjectToolbar
            obj={selectedObj}
            onChange={(patch) => handleObjectStyleChange(selectedObj.id, patch)}
            onDelete={() => handleDeleteObject(selectedObj.id)}
            style={{
              position: "absolute",
              left: pan.x + (selectedObjPos.x + selectedObjPos.w / 2) * zoom,
              top: pan.y + selectedObjPos.y * zoom - 12,
              transform: "translate(-50%, -100%)",
            }}
          />
        </div>
      )}

      <div
        ref={viewportRef}
        className={cn(
          "dot-grid-bg h-full w-full touch-none",
          tool === "select" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair",
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
        }}
        onPointerUp={(e) => {
          onBackgroundPointerUp(e);
          onResizeHandlePointerUp();
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
            return (
              <div
                key={item.id}
                data-canvas-item
                onPointerDown={(e) => onNodePointerDown(e, ref)}
                onPointerMove={(e) => onNodePointerMove(e, ref)}
                onPointerUp={(e) => onNodePointerUp(e, ref)}
                className="absolute cursor-pointer touch-none select-none rounded-xl shadow-[0_10px_28px_-10px_rgba(0,0,0,0.5)] transition-shadow hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)]"
                style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h, zIndex: pos.zIndex }}
              >
                <CanvasItemBody item={item} />
              </div>
            );
          })}

          {canvasObjectsState.map((obj) => {
            const pos = positions[obj.id];
            if (!pos) return null;
            const ref: NodeRef = { kind: "object", id: obj.id };
            const selected = selectedId === obj.id;
            return (
              <div
                key={obj.id}
                data-canvas-item
                onPointerDown={(e) => onNodePointerDown(e, ref)}
                onPointerMove={(e) => onNodePointerMove(e, ref)}
                onPointerUp={(e) => onNodePointerUp(e, ref)}
                className={cn(
                  "absolute touch-none select-none",
                  obj.type === "frame" ? "cursor-default" : "cursor-pointer",
                )}
                style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h, zIndex: pos.zIndex }}
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
                {selected && (
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
                  </>
                )}
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
        className="flex h-full w-full flex-col rounded-md p-3 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.35)]"
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
    return (
      <div
        className="h-full w-full shadow-[0_8px_20px_-8px_rgba(0,0,0,0.3)]"
        style={{
          background: obj.fill ?? "#BFDBFE",
          borderRadius: obj.shapeVariant === "ellipse" ? "9999px" : 14,
        }}
      />
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
