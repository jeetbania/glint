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
import type {
  ApiCanvasObject,
  CanvasObjectType,
  CanvasShapeVariant,
  CanvasConnectorType,
  CanvasConnectorDecoration,
  CanvasConnectorAnchor,
  CanvasConnectorBinding,
  ConnectorToolId,
} from "@/types/canvas-object";
import { boundsForConnectorPoints } from "@/lib/local/canvas-objects";
import { localFetch } from "@/lib/local/api";
import { useResolvedImageSrc, putBlob, localBlobRef } from "@/lib/local/blobs";
import { enrichSavedImage } from "@/lib/auto-enrich-image";

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
// Drag tilt — a card/shape leans slightly in the direction it's being
// dragged, Trello/FigJam-style. The whole pipeline (see processDragFrame):
// raw per-frame pointer delta -> normalize to a velocity -> dead zone ->
// low-pass filter (smoothedVelocity) -> clamp -> spring-damp toward the
// rendered angle (currentTilt). Never set rotation directly from a raw
// event; only currentTilt (spring-damped, rAF-driven) is ever painted.
const DRAG_TILT_MAX_DEG = 8; // clamp target rotation to a small, subtle range
const DRAG_TILT_SENSITIVITY = 2.5; // degrees per (px moved per ~16ms of real elapsed time) of smoothed velocity
const DRAG_TILT_VELOCITY_SMOOTHING = 0.3; // low-pass filter factor (0-1): how fast smoothedVelocity follows the raw per-frame velocity
const DRAG_TILT_SPRING = 0.35; // per-frame approach factor: how fast the rendered tilt chases its (smoothed, clamped) target
const DRAG_TILT_DEAD_ZONE = 0.5; // px (per ~16ms) below which movement is treated as zero — ignores tiny pointer jitter while "holding still"
const DRAG_TILT_SETTLE_EPSILON = 0.05; // deg — once |currentTilt| drops below this after release, the drag is considered settled

// ---------------------------------------------------------------------
// Connectors — Figma/FigJam-style lines/arrows/elbow connectors. Unlike
// every other canvas object, a connector's real geometry is its own
// `points` array (world/canvas-space: [start, ...bend point(s), end]) —
// x/y/w/h are only ever a bounding-box CACHE derived from that array
// (boundsForConnectorPoints, lib/local/canvas-objects.ts), kept in sync
// purely so the rest of the app's generic per-node machinery (the
// positions map, z-order, marquee/frame-containment hit-testing, undo)
// keeps working unchanged for connectors too, without needing to know
// anything about connector geometry specifically.
//
// v1 scope note: the elbow router here always produces a single bend (3
// points, 2 segments) — the minimal route for a straight drag-to-create,
// and what "avoid unnecessary segments" trivially means at this scope.
// Genuine obstacle-avoiding multi-bend routing (routing AROUND other
// objects sitting between the two endpoints) is real pathfinding and is
// intentionally out of scope here; a user can still get any route they
// want by dragging the mid-segment handles by hand.
// ---------------------------------------------------------------------

type ConnectorPreset = {
  connectorType: CanvasConnectorType;
  startDecoration: CanvasConnectorDecoration;
  endDecoration: CanvasConnectorDecoration;
};
const CONNECTOR_PRESETS: Record<ConnectorToolId, ConnectorPreset> = {
  line: { connectorType: "straight", startDecoration: "none", endDecoration: "none" },
  arrow: { connectorType: "straight", startDecoration: "none", endDecoration: "arrow" },
  "two-way-arrow": { connectorType: "straight", startDecoration: "arrow", endDecoration: "arrow" },
  elbow: { connectorType: "elbow", startDecoration: "none", endDecoration: "arrow" },
};

const CONNECTOR_STROKE_WIDTH = 2.5; // visible px, constant at any zoom (vector-effect="non-scaling-stroke")
const CONNECTOR_HIT_STROKE_WIDTH = 16; // invisible click/drag target — much easier to grab than the 2.5px visible line
const CONNECTOR_ARROWHEAD_SIZE = 9; // marker units — see the <marker> defs in ConnectorLayer
const CONNECTOR_SNAP_RADIUS_SCREEN_PX = 26; // how close an endpoint must get to a candidate anchor, in SCREEN px, to snap/bind
const CONNECTOR_ANCHORS: CanvasConnectorAnchor[] = ["top", "right", "bottom", "left", "center"];

/** The five points a connector endpoint can snap/bind to on another
 * object, in world (canvas) coordinates, derived from that object's
 * CURRENT position/size — never stored, always computed fresh. */
function connectorAnchorPoint(pos: Position, anchor: CanvasConnectorAnchor): { x: number; y: number } {
  const cx = pos.x + pos.w / 2;
  const cy = pos.y + pos.h / 2;
  switch (anchor) {
    case "top":
      return { x: cx, y: pos.y };
    case "bottom":
      return { x: cx, y: pos.y + pos.h };
    case "left":
      return { x: pos.x, y: cy };
    case "right":
      return { x: pos.x + pos.w, y: cy };
    case "center":
      return { x: cx, y: cy };
  }
}

type BindingCandidate = { objectId: string; anchor: CanvasConnectorAnchor; point: { x: number; y: number } };

/** Nearest bindable anchor (across every eligible object) to a world
 * point, or null if nothing is within snapRadius. */
function findBindingCandidate(
  worldPt: { x: number; y: number },
  eligible: { id: string; pos: Position }[],
  snapRadius: number,
): BindingCandidate | null {
  let best: (BindingCandidate & { dist: number }) | null = null;
  for (const { id, pos } of eligible) {
    for (const anchor of CONNECTOR_ANCHORS) {
      const point = connectorAnchorPoint(pos, anchor);
      const dist = Math.hypot(point.x - worldPt.x, point.y - worldPt.y);
      if (dist <= snapRadius && (!best || dist < best.dist)) {
        best = { objectId: id, anchor, point, dist };
      }
    }
  }
  return best;
}

/** A connector's REAL, live-rendered points: the stored `points` array,
 * except an end with a binding is resolved fresh from the bound object's
 * CURRENT position every time this runs. This alone is the entire
 * mechanism that keeps a connector attached as its target moves — no
 * special sync code needed anywhere a bound object's position can
 * change (drag, resize, undo/redo — all of it flows through the same
 * `positions` map this reads). */
function resolveConnectorPoints(
  obj: ApiCanvasObject,
  positions: Record<string, Position>,
): { x: number; y: number }[] {
  const points = obj.points ?? [];
  if (points.length === 0) return points;
  const resolved = points.map((p) => ({ ...p }));
  let endpointMoved = false;
  if (obj.startBinding) {
    const pos = positions[obj.startBinding.objectId];
    if (pos) {
      resolved[0] = connectorAnchorPoint(pos, obj.startBinding.anchor);
      endpointMoved = true;
    }
  }
  if (obj.endBinding) {
    const pos = positions[obj.endBinding.objectId];
    if (pos) {
      resolved[resolved.length - 1] = connectorAnchorPoint(pos, obj.endBinding.anchor);
      endpointMoved = true;
    }
  }
  // An elbow whose bound target moved (rather than being dragged by its
  // own handle, which already re-routes live — see processConnectorFrame)
  // still needs its corner re-derived here, or it'd stay stuck at its old
  // position and the connector would render as a diagonal kink instead of
  // a clean right angle. Orientation is taken from the STORED points (not
  // the just-resolved ones) so it stays stable across renders.
  if (endpointMoved && resolved.length === 3) {
    return rerouteElbow(resolved[0], resolved[2], elbowOrientation(points));
  }
  return resolved;
}

/** Whether a 3-point elbow's bend currently runs horizontal-then-vertical
 * (the corner shares its Y with start) or vertical-then-horizontal (the
 * corner shares its X with start) — inferred from the points themselves
 * rather than stored separately, so there's nothing extra to keep in
 * sync when a segment gets dragged. */
function elbowOrientation(points: { x: number; y: number }[]): "h-first" | "v-first" {
  const [start, corner] = points;
  return Math.abs(corner.y - start.y) <= Math.abs(corner.x - start.x) ? "h-first" : "v-first";
}

/** Re-derives a 3-point elbow's corner from a new start/end, preserving
 * whichever orientation it already had — this is what "the path
 * automatically recalculates when either endpoint moves" means for the
 * single-bend model here. */
function rerouteElbow(
  start: { x: number; y: number },
  end: { x: number; y: number },
  orientation: "h-first" | "v-first",
): { x: number; y: number }[] {
  const corner = orientation === "h-first" ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
  return [start, corner, end];
}

/** A fresh elbow's initial route, for drag-to-create — picks whichever
 * orientation matches the drag's dominant axis, so a wide drag reads as
 * horizontal-then-vertical and a tall one reads as
 * vertical-then-horizontal. */
function initialElbowRoute(
  start: { x: number; y: number },
  end: { x: number; y: number },
): { x: number; y: number }[] {
  const orientation = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? "h-first" : "v-first";
  return rerouteElbow(start, end, orientation);
}

/** SVG path `d` for a connector's points, in plain WORLD (canvas-space)
 * coordinates — ConnectorLayer's <svg> has no viewBox of its own (1 SVG
 * user unit = 1 CSS px), so it inherits the SAME pan/zoom transform as
 * every other object in the same wrapper for free, with zero extra
 * per-connector coordinate math and (critically) no non-uniform scaling
 * of the kind that stretched the old shape-based arrows this replaces. */
function connectorPathD(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

type UndoEntry =
  | { type: "position"; ref: NodeRef; before: Position; after: Position }
  | { type: "group-position"; refs: NodeRef[]; before: Position[]; after: Position[] }
  | { type: "object-create"; obj: ApiCanvasObject }
  | { type: "group-create"; objs: ApiCanvasObject[] }
  | { type: "object-delete"; obj: ApiCanvasObject }
  | { type: "group-delete"; objs: ApiCanvasObject[] }
  | { type: "object-update"; id: string; before: CanvasObjectPatch; after: CanvasObjectPatch };

// One-shot shapes (dropped centered in the view immediately).
const SHAPE_SHORTCUT_KEYS: Record<string, CanvasShapeVariant> = {
  r: "rectangle",
  e: "ellipse",
  y: "triangle",
};
// Connector tools (ARM the tool — drag-to-draw on the canvas — rather
// than one-shot placing something; see the CONNECTOR CREATION section).
const CONNECTOR_SHORTCUT_KEYS: Record<string, ConnectorToolId> = {
  l: "line",
  a: "arrow",
  w: "two-way-arrow",
  b: "elbow",
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

// The object's own persisted rotate/flip, WITHOUT a translate — kept
// separate from nodeTransform() below so a drag frame can reuse just
// this part (fixed for the duration of a drag) while swapping in a
// fresh translate every frame.
function canvasObjectTransform(obj: ApiCanvasObject): string | undefined {
  const parts: string[] = [];
  if (obj.rotation) parts.push(`rotate(${obj.rotation}deg)`);
  if (obj.flipX) parts.push("scaleX(-1)");
  if (obj.flipY) parts.push("scaleY(-1)");
  return parts.length > 0 ? parts.join(" ") : undefined;
}

// Position is painted via `transform: translate()` rather than the
// `left`/`top` CSS properties — left/top are layout properties, so
// writing them on every pointermove during a drag forces the browser to
// recompute layout on every single frame, which is what actually caused
// the reported drag stutter/jitter. `translate()` is compositor-only, so
// the browser can move the element every frame without ever touching
// layout. The drag tilt (see the DRAG_TILT_* constants above) rides in
// this SAME string too, right after the translate — deliberately not on
// the standalone CSS `rotate` property, which composes with `transform`
// in a separate, easy-to-get-wrong step; folding everything into one
// string keeps the composition unambiguous. `suffix` is the object's own
// persisted rotate/flip (canvasObjectTransform above) for canvas
// objects, or undefined for library items (which don't have one).
function nodeTransform(x: number, y: number, tiltDeg: number, suffix?: string): string {
  const parts = [`translate(${x}px, ${y}px)`];
  if (Math.abs(tiltDeg) >= 0.01) parts.push(`rotate(${tiltDeg}deg)`);
  if (suffix) parts.push(suffix);
  return parts.join(" ");
}

function rectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Default shape/geometry for each newly-placed canvas object, keyed off
 * the click point so it lands centered on the cursor. Connectors are
 * NOT created through here — they have no sensible "centered default
 * size" (their whole shape comes from where the user drags), so they go
 * through their own createConnectorAt path instead; see the CONNECTOR
 * CREATION section below. */
function defaultObjectFor(
  type: Exclude<CanvasObjectType, "connector">,
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
    case "shape":
      // "line"/"arrow"/"elbow-arrow" aren't offered from the shape
      // dropdown anymore — connectors have their own tools/creation flow
      // (see the CONNECTOR CREATION section) — so shapeVariant here is
      // always rectangle/ellipse/triangle in practice.
      return {
        type,
        x: cx - 80,
        y: cy - 80,
        w: 160,
        h: 160,
        zIndex,
        fill: "#BFDBFE",
        shapeVariant,
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
   * so frames never drag each other. Connectors are excluded too: they
   * aren't part of the generic per-node drag machinery this sweeps
   * along (their real geometry is `points`, not x/y — see the CONNECTOR
   * CREATION section), so including one here would desync its cached
   * bounding box from what's actually drawn instead of moving it. A
   * connector BOUND to something inside the frame still follows
   * correctly regardless, via resolveConnectorPoints re-resolving
   * against that target's new (frame-dragged) position on every render —
   * only a geometrically-overlapping-but-unbound connector doesn't get
   * swept along, which is a reasonable v1 gap given it wasn't going to
   * move correctly through this path anyway. */
  function getFrameContainedIds(framePos: Position, frameId: string): string[] {
    const ids: string[] = [];
    for (const it of items) {
      const p = positions[it.id];
      if (p && isCenterInside(p, framePos)) ids.push(it.id);
    }
    for (const o of canvasObjectsState) {
      if (o.id === frameId || o.type === "frame" || o.type === "connector") continue;
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

  /** Screen (clientX/Y) -> canvas/world coordinates — every connector
   * geometry edit (creation-drag, endpoint drag, segment drag) MUST go
   * through this rather than using raw pointer deltas directly, so
   * dragging behaves identically at any zoom/pan (same formula zoomAt
   * above uses for its own screen<->world conversion). */
  function screenToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const rect = viewportRef.current?.getBoundingClientRect();
    const px = clientX - (rect?.left ?? 0);
    const py = clientY - (rect?.top ?? 0);
    return {
      x: (px - panRef.current.x) / zoomRef.current,
      y: (py - panRef.current.y) / zoomRef.current,
    };
  }

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

  // Which connector tool (if any) is armed — set by clicking one of the
  // connector entries in CanvasToolbar (or its shortcut key), unlike
  // every other "add" button which places its thing immediately. While
  // armed, dragging on the canvas draws a new connector instead of
  // marquee-selecting/panning — see the CONNECTOR CREATION section.
  const [pendingConnectorTool, setPendingConnectorTool] = useState<ConnectorToolId | null>(null);
  // The nearby object (if any) a connector endpoint is currently
  // snapping to — during creation-drag or an existing endpoint-handle
  // drag. Only changes (and re-renders) when the snapped candidate
  // itself changes, not on every pointermove, so this stays cheap; the
  // endpoint's own live position is still painted imperatively every
  // frame (see connectorDrag below), same as every other canvas drag.
  const [hoverBinding, setHoverBinding] = useState<BindingCandidate | null>(null);

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
    } else if (entry.type === "group-create") {
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
    } else if (entry.type === "group-create") {
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
        setPendingConnectorTool(null);
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d" && selectedIds.length > 0) {
        // Overrides the browser's own "bookmark this page" shortcut —
        // acceptable on a canvas that's meant to be worked in with the
        // keyboard, same trade-off Figma/FigJam make.
        e.preventDefault();
        void handleDuplicateSelection();
        return;
      }
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && selectedObj) {
        // Figma's own flip shortcuts — single-selection only, matching
        // the rich toolbar's flip buttons (a multi-selection flip would
        // need to flip the whole group's layout, not just each object
        // in place, which is a bigger feature left for later).
        if (e.key.toLowerCase() === "h") {
          e.preventDefault();
          handleObjectStyleChange(selectedObj.id, { flipX: !selectedObj.flipX });
          return;
        }
        if (e.key.toLowerCase() === "v") {
          e.preventDefault();
          handleObjectStyleChange(selectedObj.id, { flipY: !selectedObj.flipY });
          return;
        }
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const variant = SHAPE_SHORTCUT_KEYS[e.key.toLowerCase()];
        if (variant) {
          e.preventDefault();
          handleAddShape(variant);
          return;
        }
        const connectorTool = CONNECTOR_SHORTCUT_KEYS[e.key.toLowerCase()];
        if (connectorTool) {
          e.preventDefault();
          setPendingConnectorTool(connectorTool);
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
    type: Exclude<CanvasObjectType, "connector">,
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
  // CONNECTOR CREATION — arm a tool (CanvasToolbar or its shortcut key),
  // then mouse down -> drag -> mouse up on the canvas draws it, FigJam-
  // style, instead of the one-shot "drop it centered" flow every other
  // object uses. A dedicated full-viewport overlay (rendered only while
  // a tool is armed — see the JSX below) captures the whole gesture in
  // SCREEN space so it works the same whether the drag starts over empty
  // canvas or on top of an existing object (which onNodePointerDown's
  // own stopPropagation would otherwise swallow).
  // -------------------------------------------------------------------

  /** Every object a connector endpoint can snap/bind to — every visible
   * item plus every non-connector canvas object (a connector never binds
   * to another connector). */
  function getBindingEligibleCandidates(): { id: string; pos: Position }[] {
    const out: { id: string; pos: Position }[] = [];
    for (const item of visibleItems) {
      const pos = positions[item.id];
      if (pos) out.push({ id: item.id, pos });
    }
    for (const obj of canvasObjectsState) {
      if (obj.type === "connector") continue;
      const pos = positions[obj.id];
      if (pos) out.push({ id: obj.id, pos });
    }
    return out;
  }

  // Live DOM refs for each connector currently on the canvas — same
  // "write straight to the DOM every frame, bypass setState" approach as
  // nodeElRefs above, and for the same reason (a full React re-render on
  // every pointermove is what caused the originally-reported drag
  // jitter). Populated by ConnectorLayer's JSX below.
  type ConnectorEls = {
    path: SVGPathElement | null;
    hitPath: SVGPathElement | null;
    handles: (SVGCircleElement | null)[];
    segHandles: (SVGLineElement | null)[];
  };
  const connectorElRefs = useRef<Record<string, ConnectorEls>>({});
  function getConnectorEls(id: string): ConnectorEls {
    if (!connectorElRefs.current[id]) {
      connectorElRefs.current[id] = { path: null, hitPath: null, handles: [], segHandles: [] };
    }
    return connectorElRefs.current[id];
  }

  /** Writes a connector's current points straight to its DOM elements —
   * the path geometry (both the visible stroke and the wider invisible
   * hit-area share the same `d`) and every handle's position. Called
   * every animation frame during any connector drag (create, endpoint,
   * segment, or body) — see processConnectorFrame. */
  function writeConnectorDom(id: string, points: { x: number; y: number }[]) {
    const els = connectorElRefs.current[id];
    if (!els) return;
    const d = connectorPathD(points);
    if (els.path) els.path.setAttribute("d", d);
    if (els.hitPath) els.hitPath.setAttribute("d", d);
    points.forEach((p, i) => {
      const h = els.handles[i];
      if (h) {
        h.setAttribute("cx", String(p.x));
        h.setAttribute("cy", String(p.y));
      }
    });
    if (points.length === 3) {
      const [start, corner, end] = points;
      const seg0 = els.segHandles[0];
      const seg1 = els.segHandles[1];
      if (seg0) {
        seg0.setAttribute("x1", String(start.x));
        seg0.setAttribute("y1", String(start.y));
        seg0.setAttribute("x2", String(corner.x));
        seg0.setAttribute("y2", String(corner.y));
      }
      if (seg1) {
        seg1.setAttribute("x1", String(corner.x));
        seg1.setAttribute("y1", String(corner.y));
        seg1.setAttribute("x2", String(end.x));
        seg1.setAttribute("y2", String(end.y));
      }
    }
  }

  // Only re-renders (via React state) when the SNAPPED candidate itself
  // changes — not on every pointermove — so the anchor-dot indicator can
  // mount/unmount without turning connector dragging into a full-canvas
  // re-render loop.
  function setHoverBindingIfChanged(next: BindingCandidate | null) {
    setHoverBinding((prev) => {
      if (prev?.objectId === next?.objectId && prev?.anchor === next?.anchor) return prev;
      return next;
    });
  }

  const connectorRafRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (connectorRafRef.current != null) cancelAnimationFrame(connectorRafRef.current);
    };
  }, []);

  type ConnectorCreateDragState = {
    toolId: ConnectorToolId;
    start: { x: number; y: number };
    latestWorld: { x: number; y: number };
    startBinding: CanvasConnectorBinding | null;
    endBinding: CanvasConnectorBinding | null;
    moved: boolean;
  };
  const connectorCreateDrag = useRef<ConnectorCreateDragState | null>(null);
  // Mounts/unmounts the preview <path> — separate from the ref above so
  // React only re-renders once per drag (on mount) instead of per frame;
  // the preview's actual geometry is written imperatively, same as every
  // other connector element.
  const [connectorPreviewActive, setConnectorPreviewActive] = useState(false);
  const PREVIEW_ID = "__connector_preview__";

  function onConnectorCreatePointerDown(e: React.PointerEvent) {
    if (!pendingConnectorTool || e.button !== 0) return;
    const world = screenToCanvas(e.clientX, e.clientY);
    const candidate = findBindingCandidate(
      world,
      getBindingEligibleCandidates(),
      CONNECTOR_SNAP_RADIUS_SCREEN_PX / zoomRef.current,
    );
    const start = candidate?.point ?? world;
    connectorCreateDrag.current = {
      toolId: pendingConnectorTool,
      start,
      latestWorld: start,
      startBinding: candidate ? { objectId: candidate.objectId, anchor: candidate.anchor } : null,
      endBinding: null,
      moved: false,
    };
    setHoverBindingIfChanged(candidate);
    setConnectorPreviewActive(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onConnectorCreatePointerMove(e: React.PointerEvent) {
    const drag = connectorCreateDrag.current;
    if (!drag) return;
    drag.latestWorld = screenToCanvas(e.clientX, e.clientY);
    if (
      Math.abs(drag.latestWorld.x - drag.start.x) > CLICK_THRESHOLD ||
      Math.abs(drag.latestWorld.y - drag.start.y) > CLICK_THRESHOLD
    ) {
      drag.moved = true;
    }
    if (connectorRafRef.current == null) {
      connectorRafRef.current = requestAnimationFrame(processConnectorFrame);
    }
  }

  async function onConnectorCreatePointerUp() {
    if (connectorRafRef.current != null) {
      cancelAnimationFrame(connectorRafRef.current);
      connectorRafRef.current = null;
    }
    const drag = connectorCreateDrag.current;
    connectorCreateDrag.current = null;
    setConnectorPreviewActive(false);
    setHoverBindingIfChanged(null);
    if (!drag || !drag.moved) return; // a plain click with no real drag creates nothing

    const preset = CONNECTOR_PRESETS[drag.toolId];
    const end = drag.latestWorld;
    const points =
      preset.connectorType === "elbow" ? initialElbowRoute(drag.start, end) : [drag.start, end];
    const bounds = boundsForConnectorPoints(points);
    const z = ++maxZ.current;
    const input = {
      type: "connector" as const,
      points,
      connectorType: preset.connectorType,
      startDecoration: preset.startDecoration,
      endDecoration: preset.endDecoration,
      startBinding: drag.startBinding,
      endBinding: drag.endBinding,
      fill: "#3B5BDB",
      zIndex: z,
      ...bounds,
    };
    try {
      const created = await createObjectOnServer(input);
      setCanvasObjectsState((prev) => [...prev, created]);
      setPositions((prev) => ({
        ...prev,
        [created.id]: { x: created.x, y: created.y, w: created.w, h: created.h, zIndex: created.zIndex },
      }));
      setSelectedIds([created.id]);
      pushUndo({ type: "object-create", obj: created });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add that");
    }
  }

  // -------------------------------------------------------------------
  // CONNECTOR EDITING — dragging an existing connector's start/end
  // handle, an elbow's mid-segment handle, or its body (the whole line).
  // Shares the rAF loop and DOM-write approach above with creation (only
  // one of the two is ever active at once).
  // -------------------------------------------------------------------

  type ConnectorEditKind = "start" | "end" | "segment" | "body";
  type ConnectorEditDragState = {
    objId: string;
    kind: ConnectorEditKind;
    segmentIndex: number; // "segment" only: 0 = start-side, 1 = end-side
    /** Locked in at drag-start from the connector's CURRENT route, so a
     * mid-drag wobble in which delta is bigger can't suddenly flip which
     * way the elbow bends. Only meaningful for a 3-point elbow. */
    elbowOrientation: "h-first" | "v-first" | null;
    origPoints: { x: number; y: number }[];
    points: { x: number; y: number }[];
    startBinding: CanvasConnectorBinding | null;
    endBinding: CanvasConnectorBinding | null;
    startWorld: { x: number; y: number };
    latestWorld: { x: number; y: number };
    startClientX: number;
    startClientY: number;
    moved: boolean;
  };
  const connectorEditDrag = useRef<ConnectorEditDragState | null>(null);

  function beginConnectorEditDrag(e: React.PointerEvent, obj: ApiCanvasObject, kind: ConnectorEditKind, segmentIndex = 0) {
    e.stopPropagation();
    const livePoints = resolveConnectorPoints(obj, positions);
    const world = screenToCanvas(e.clientX, e.clientY);
    connectorEditDrag.current = {
      objId: obj.id,
      kind,
      segmentIndex,
      elbowOrientation: livePoints.length === 3 ? elbowOrientation(livePoints) : null,
      origPoints: livePoints.map((p) => ({ ...p })),
      points: livePoints.map((p) => ({ ...p })),
      startBinding: obj.startBinding,
      endBinding: obj.endBinding,
      startWorld: world,
      latestWorld: world,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    };
    if (!(selectedIds.length === 1 && selectedIds[0] === obj.id)) setSelectedIds([obj.id]);
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onConnectorHandlePointerDown(e: React.PointerEvent, obj: ApiCanvasObject, which: "start" | "end") {
    beginConnectorEditDrag(e, obj, which);
  }
  function onConnectorSegmentPointerDown(e: React.PointerEvent, obj: ApiCanvasObject, segmentIndex: 0 | 1) {
    beginConnectorEditDrag(e, obj, "segment", segmentIndex);
  }
  function onConnectorBodyPointerDown(e: React.PointerEvent, obj: ApiCanvasObject) {
    beginConnectorEditDrag(e, obj, "body");
  }

  function onConnectorEditPointerMove(e: React.PointerEvent) {
    const drag = connectorEditDrag.current;
    if (!drag) return;
    drag.latestWorld = screenToCanvas(e.clientX, e.clientY);
    if (
      Math.abs(e.clientX - drag.startClientX) > CLICK_THRESHOLD ||
      Math.abs(e.clientY - drag.startClientY) > CLICK_THRESHOLD
    ) {
      drag.moved = true;
    }
    if (connectorRafRef.current == null) {
      connectorRafRef.current = requestAnimationFrame(processConnectorFrame);
    }
  }

  function onConnectorEditPointerUp() {
    if (connectorRafRef.current != null) {
      cancelAnimationFrame(connectorRafRef.current);
      connectorRafRef.current = null;
    }
    const drag = connectorEditDrag.current;
    connectorEditDrag.current = null;
    setHoverBindingIfChanged(null);
    // A plain click (no real movement) is just a select — committing here
    // too would both fire a needless network PATCH and (worse, for the
    // "body" kind) unbind a connector's endpoints just because it was
    // clicked, not actually dragged.
    if (!drag || !drag.moved) return;
    handleObjectStyleChange(drag.objId, {
      points: drag.points,
      startBinding: drag.startBinding,
      endBinding: drag.endBinding,
    });
  }

  // Runs at most once per animation frame while a connector create or
  // edit drag is in progress — mirrors processDragFrame's shape exactly
  // (read the latest known pointer position, write straight to the DOM,
  // reschedule while the drag is still live) for the same performance
  // reason: going through React state on every pointer event would
  // re-render the whole canvas on every single mouse-move tick.
  function processConnectorFrame() {
    connectorRafRef.current = null;

    const create = connectorCreateDrag.current;
    if (create) {
      if (!create.moved) return;
      const preset = CONNECTOR_PRESETS[create.toolId];
      const eligible = getBindingEligibleCandidates();
      const candidate = findBindingCandidate(
        create.latestWorld,
        eligible,
        CONNECTOR_SNAP_RADIUS_SCREEN_PX / zoomRef.current,
      );
      const end = candidate?.point ?? create.latestWorld;
      create.endBinding = candidate ? { objectId: candidate.objectId, anchor: candidate.anchor } : null;
      const points =
        preset.connectorType === "elbow" ? initialElbowRoute(create.start, end) : [create.start, end];
      writeConnectorDom(PREVIEW_ID, points);
      setHoverBindingIfChanged(candidate);
      connectorRafRef.current = requestAnimationFrame(processConnectorFrame);
      return;
    }

    const edit = connectorEditDrag.current;
    if (edit) {
      const world = edit.latestWorld;
      if (edit.kind === "body") {
        const dx = world.x - edit.startWorld.x;
        const dy = world.y - edit.startWorld.y;
        edit.points = edit.origPoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        // Dragging the whole body detaches it from anything it was
        // bound to — its position is no longer implied by a target
        // object once you've explicitly moved it as a free line.
        edit.startBinding = null;
        edit.endBinding = null;
      } else if (edit.kind === "start" || edit.kind === "end") {
        const eligible = getBindingEligibleCandidates();
        const candidate = findBindingCandidate(
          world,
          eligible,
          CONNECTOR_SNAP_RADIUS_SCREEN_PX / zoomRef.current,
        );
        const newPoint = candidate?.point ?? world;
        const binding = candidate ? { objectId: candidate.objectId, anchor: candidate.anchor } : null;
        if (edit.kind === "start") {
          edit.points[0] = newPoint;
          edit.startBinding = binding;
        } else {
          edit.points[edit.points.length - 1] = newPoint;
          edit.endBinding = binding;
        }
        if (edit.elbowOrientation && edit.points.length === 3) {
          edit.points = rerouteElbow(edit.points[0], edit.points[edit.points.length - 1], edit.elbowOrientation);
        }
        setHoverBindingIfChanged(candidate);
      } else if (edit.kind === "segment" && edit.elbowOrientation && edit.points.length === 3) {
        const dx = world.x - edit.startWorld.x;
        const dy = world.y - edit.startWorld.y;
        const pts = edit.origPoints.map((p) => ({ ...p }));
        const horizontal = edit.elbowOrientation === "h-first";
        if (edit.segmentIndex === 0) {
          // The start-side segment — constrained perpendicular to its
          // own orientation, and detaches the start binding (if any)
          // since this moves the start point away from its anchor.
          if (horizontal) {
            pts[0].y += dy;
            pts[1].y += dy;
          } else {
            pts[0].x += dx;
            pts[1].x += dx;
          }
          edit.startBinding = null;
        } else {
          if (horizontal) {
            pts[1].x += dx;
            pts[2].x += dx;
          } else {
            pts[1].y += dy;
            pts[2].y += dy;
          }
          edit.endBinding = null;
        }
        edit.points = pts;
      }
      writeConnectorDom(edit.objId, edit.points);
      connectorRafRef.current = requestAnimationFrame(processConnectorFrame);
    }
  }

  // -------------------------------------------------------------------
  // Per-node drag (move a card/object, or the whole selection together
  // if the node being dragged is part of a multi-selection). Persisted
  // on release; a plain click (no movement) selects/opens/edits instead.
  // -------------------------------------------------------------------
  type NodeDragState = {
    refs: NodeRef[];
    primaryId: string;
    startX: number;
    startY: number;
    /** Updated on every raw pointermove event — always the freshest known
     * pointer position. */
    latestX: number;
    latestY: number;
    /** Updated only inside processDragFrame, once per animation frame —
     * velocity is measured against THIS, not the previous raw event, so
     * it reads as "distance moved since last frame" instead of "distance
     * moved since last event" (noisy, since events don't arrive at a
     * fixed cadence). */
    frameX: number;
    /** performance.now() at the last processed frame — lets velocity be
     * normalized against real elapsed time instead of assuming a fixed
     * ~16ms between frames (a dropped frame or a throttled tab shouldn't
     * read as a sudden burst of extra velocity). */
    lastFrameTime: number;
    /** Low-pass-filtered velocity — see DRAG_TILT_VELOCITY_SMOOTHING. Raw
     * per-frame velocity is never used directly for anything visual. */
    smoothedVelocity: number;
    /** The actual rendered tilt angle — spring-damped toward its target
     * every frame (DRAG_TILT_SPRING), never snapped straight to it. This
     * is the ONLY tilt value that ever gets painted. */
    currentTilt: number;
    bases: Record<string, Position>;
    /** Each dragged node's own persisted rotate/flip (canvas objects
     * only) — fixed for the whole drag, spliced back onto the live
     * translate every frame in processDragFrame so an already-rotated
     * shape keeps its angle while being dragged around. */
    transformSuffixes: Record<string, string | undefined>;
    moved: boolean;
    /** Set on pointerup: the position is frozen at this exact release
     * offset and processDragFrame stops tracking the pointer, instead
     * just easing currentTilt back toward 0 on the same rAF loop — a
     * natural settle instead of an instant snap-to-flat, with the final
     * position/undo-entry/persistence only committed once it's visually
     * neutral (see finishNodeDrag). */
    releasing: boolean;
    releaseDx: number;
    releaseDy: number;
  };
  const nodeDrag = useRef<NodeDragState | null>(null);

  // Live DOM nodes for each item/object currently on the canvas, keyed by
  // id — lets the drag handlers below write position/tilt straight to the
  // element's inline style every animation frame instead of going through
  // setState, which would otherwise re-render every OTHER item/object on
  // the canvas too on every single pointermove (that full-subtree re-render
  // per event was the actual cause of the reported drag jitter — not the
  // tilt math itself). React state is untouched for the ENTIRE drag +
  // release-settle animation, only committed once at the very end (see
  // finishNodeDrag), so the canvas stays cheap to paint regardless of how
  // many items it holds and re-renders don't fight the rAF loop's own
  // inline style writes mid-drag.
  const nodeElRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragRafRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (dragRafRef.current != null) cancelAnimationFrame(dragRafRef.current);
    };
  }, []);

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
    const transformSuffixes: Record<string, string | undefined> = {};
    for (const r of refs) {
      const p = positions[r.id];
      if (p) bases[r.id] = p;
      if (r.kind === "object") {
        const o = canvasObjectsState.find((c) => c.id === r.id);
        if (o) transformSuffixes[r.id] = canvasObjectTransform(o);
      }
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
      lastFrameTime: performance.now(),
      smoothedVelocity: 0,
      currentTilt: 0,
      bases,
      transformSuffixes,
      moved: false,
      releasing: false,
      releaseDx: 0,
      releaseDy: 0,
    };
    target.setPointerCapture(e.pointerId);
  }

  // Commits a finished drag — either called from processDragFrame once
  // the release-settle tilt animation has reached ~0, or (for a drag that
  // ends with no tilt at all) effectively immediately. This is the ONLY
  // place React state changes during the whole drag+release lifecycle:
  // final position, the undo entry, and persistence all happen here,
  // once, instead of being spread across the drag.
  function finishNodeDrag(drag: NodeDragState) {
    nodeDrag.current = null;
    const zBase = maxZ.current;
    const updates: Record<string, Position> = {};
    drag.refs.forEach((r, i) => {
      const base = drag.bases[r.id];
      updates[r.id] = { ...base, x: base.x + drag.releaseDx, y: base.y + drag.releaseDy, zIndex: zBase + i + 1 };
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

  // Runs at most once per animation frame while a node drag (or its
  // release-settle tail) is in progress — reads the latest known pointer
  // position (kept fresh by onNodePointerMove on every raw event) and
  // writes position + tilt straight to each dragged element's inline
  // style via nodeElRefs, bypassing setState entirely. That's what keeps
  // a drag smooth regardless of how many other items/objects are sitting
  // on the canvas — going through React state on every pointer event was
  // re-rendering the ENTIRE canvas on every single mouse-move tick, which
  // is what actually caused the originally-reported jitter.
  function processDragFrame() {
    dragRafRef.current = null;
    const drag = nodeDrag.current;
    if (!drag || (!drag.moved && !drag.releasing)) return;

    const now = performance.now();
    const dtMs = Math.max(1, now - drag.lastFrameTime);
    drag.lastFrameTime = now;

    let dx: number;
    let dy: number;

    if (drag.releasing) {
      // Position is frozen at the exact offset the pointer was released
      // at — from here only the tilt keeps animating, easing back to 0
      // instead of snapping flat the instant the pointer lifts.
      dx = drag.releaseDx;
      dy = drag.releaseDy;
      drag.currentTilt += (0 - drag.currentTilt) * DRAG_TILT_SPRING;
    } else {
      dx = (drag.latestX - drag.startX) / zoomRef.current;
      dy = (drag.latestY - drag.startY) / zoomRef.current;

      // Tilt pipeline — see the DRAG_TILT_* constants' comment. Raw
      // per-frame movement (normalized to a "per ~16ms" rate using the
      // actual elapsed time, so a dropped frame doesn't read as a burst
      // of velocity) goes through a dead zone, then a low-pass filter,
      // and ONLY the filtered result ever becomes a rotation target —
      // never the raw delta directly.
      const stepDx = drag.latestX - drag.frameX;
      drag.frameX = drag.latestX;
      const rawVelocity = (stepDx / dtMs) * 16;
      const gatedVelocity = Math.abs(rawVelocity) < DRAG_TILT_DEAD_ZONE ? 0 : rawVelocity;
      drag.smoothedVelocity += (gatedVelocity - drag.smoothedVelocity) * DRAG_TILT_VELOCITY_SMOOTHING;
      const targetTilt = Math.max(
        -DRAG_TILT_MAX_DEG,
        Math.min(DRAG_TILT_MAX_DEG, drag.smoothedVelocity * DRAG_TILT_SENSITIVITY),
      );
      // Spring-damp the rendered angle toward that target rather than
      // snapping to it — this is what actually gets painted below.
      drag.currentTilt += (targetTilt - drag.currentTilt) * DRAG_TILT_SPRING;
    }

    for (const r of drag.refs) {
      const base = drag.bases[r.id];
      const el = nodeElRefs.current[r.id];
      if (base && el) {
        el.style.transform = nodeTransform(base.x + dx, base.y + dy, drag.currentTilt, drag.transformSuffixes[r.id]);
      }
    }

    if (drag.releasing && Math.abs(drag.currentTilt) < DRAG_TILT_SETTLE_EPSILON) {
      finishNodeDrag(drag);
      return;
    }

    // Keep the loop alive — needed so the spring-damped tilt keeps
    // approaching its target even in the (common) case where the pointer
    // holds still for a moment mid-drag, and so the release-settle tail
    // keeps playing after the pointer has already lifted.
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
    if (drag.moved && dragRafRef.current == null) {
      dragRafRef.current = requestAnimationFrame(processDragFrame);
    }
  }

  function onNodePointerUp(e: React.PointerEvent, ref: NodeRef) {
    const drag = nodeDrag.current;
    if (!drag || drag.primaryId !== ref.id) return;

    if (!drag.moved) {
      nodeDrag.current = null;
      if (dragRafRef.current != null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
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

    // Freeze position at this exact release offset and switch the
    // already-running rAF loop into "releasing" mode (see
    // processDragFrame) — it keeps animating currentTilt back to 0 on
    // its own, only committing the final position/undo/persistence (via
    // finishNodeDrag) once that settle is visually done. No CSS
    // transition handoff involved — the same rAF loop owns the entire
    // drag AND its release animation start to finish.
    drag.releaseDx = (e.clientX - drag.startX) / zoomRef.current;
    drag.releaseDy = (e.clientY - drag.startY) / zoomRef.current;
    drag.releasing = true;
    if (dragRafRef.current == null) {
      dragRafRef.current = requestAnimationFrame(processDragFrame);
    }
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

    // Switching a stroke-based shape's variant needs a companion size
    // nudge: line/arrow default to a thin ~4px-tall horizontal strip (see
    // defaultObjectFor), but elbow-arrow's bend needs real height to read
    // at all — switching TO it while still that thin flattens the elbow's
    // vertical leg down to nothing, so it renders as what looks like a
    // plain straight line. Switching back the other way undoes it. Only
    // fires on an actual thin<->box crossing, anchored on the shape's
    // current center so it doesn't jump around on screen.
    if (patch.shapeVariant && patch.shapeVariant !== obj.shapeVariant) {
      const wasThin = obj.shapeVariant === "line" || obj.shapeVariant === "arrow";
      const isThin = patch.shapeVariant === "line" || patch.shapeVariant === "arrow";
      const cx = obj.x + obj.w / 2;
      const cy = obj.y + obj.h / 2;
      if (wasThin && !isThin && obj.h < 40) {
        const size = Math.max(obj.w, 160);
        patch = { ...patch, x: cx - size / 2, y: cy - size / 2, w: size, h: size };
      } else if (!wasThin && isThin && obj.h > 20) {
        patch = { ...patch, y: cy - 2, h: 4 };
      }
    }

    // A connector's bounding box is ALWAYS derived from its points, never
    // set directly — see boundsForConnectorPoints's own comment. Every
    // caller that changes a connector's geometry through this function
    // (the decoration controls below, and every endpoint/segment/body
    // drag in the CONNECTOR EDITING section) just passes the new
    // `points`; the box comes along for free here.
    if (patch.points) {
      patch = { ...patch, ...boundsForConnectorPoints(patch.points) };
    }

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

  // Offset a touch down-right of the original, Figma-style, so a
  // duplicate never lands exactly on top of its source and reads as
  // "nothing happened."
  const DUPLICATE_OFFSET = 20;

  /** x/y offset for most objects — but a connector's real geometry is
   * `points`, not x/y, so THAT'S what needs offsetting there (with x/y/w/h
   * re-derived from it afterward, same as everywhere else connector
   * geometry changes). Starts from the LIVE resolved points (not the
   * possibly-stale stored ones — see resolveConnectorPoints) so a bound
   * connector's duplicate starts from where it's actually drawn right
   * now. The duplicate is also detached from any binding the original
   * had — like every other object here, "contained in a frame" or
   * "bound to a target" is a live relationship recomputed from position,
   * not something a duplicate inherits verbatim. */
  function offsetForDuplicate(obj: ApiCanvasObject, dx: number, dy: number): ApiCanvasObject {
    if (obj.type === "connector" && obj.points) {
      const points = resolveConnectorPoints(obj, positions).map((p) => ({ x: p.x + dx, y: p.y + dy }));
      return { ...obj, points, startBinding: null, endBinding: null, ...boundsForConnectorPoints(points) };
    }
    return { ...obj, x: obj.x + dx, y: obj.y + dy };
  }

  async function handleDuplicateObject(id: string) {
    const obj = canvasObjectsState.find((o) => o.id === id);
    if (!obj) return;
    try {
      const created = await recreateObjectOnServer({
        ...offsetForDuplicate(obj, DUPLICATE_OFFSET, DUPLICATE_OFFSET),
        zIndex: ++maxZ.current,
      });
      setCanvasObjectsState((prev) => [...prev, created]);
      setPositions((prev) => ({
        ...prev,
        [created.id]: { x: created.x, y: created.y, w: created.w, h: created.h, zIndex: created.zIndex },
      }));
      setSelectedIds([created.id]);
      pushUndo({ type: "object-create", obj: created });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't duplicate that");
    }
  }

  async function handleDuplicateSelection() {
    const objs = selectedIds
      .map((id) => canvasObjectsState.find((o) => o.id === id))
      .filter((o): o is ApiCanvasObject => !!o);
    if (objs.length === 0) return;
    try {
      const created = await Promise.all(
        objs.map((obj) =>
          recreateObjectOnServer({
            ...offsetForDuplicate(obj, DUPLICATE_OFFSET, DUPLICATE_OFFSET),
            zIndex: ++maxZ.current,
          }),
        ),
      );
      setCanvasObjectsState((prev) => [...prev, ...created]);
      setPositions((prev) => {
        const next = { ...prev };
        for (const c of created) next[c.id] = { x: c.x, y: c.y, w: c.w, h: c.h, zIndex: c.zIndex };
        return next;
      });
      setSelectedIds(created.map((c) => c.id));
      pushUndo({ type: "group-create", objs: created });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't duplicate that selection");
    }
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
      // Not awaited — OCR/AI categorization run in the background; the
      // canvas doesn't need to wait on them, just pick up any suggested
      // tags whenever they're ready.
      void enrichSavedImage(item.id, file).then(() => mutate(`/api/collections/${collectionSlug}`));
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
            setPendingConnectorTool(null);
          }}
          onAddImage={() => fileInputRef.current?.click()}
          onAddSticky={handleAddSticky}
          onAddText={handleAddText}
          onAddShape={handleAddShape}
          onAddFrame={handleAddFrame}
          pendingConnectorTool={pendingConnectorTool}
          onArmConnectorTool={(id) => setPendingConnectorTool((cur) => (cur === id ? null : id))}
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
            onDuplicate={() => void handleDuplicateObject(selectedObj.id)}
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
            onDuplicate={
              selectedIds.some((id) => canvasObjectsState.some((o) => o.id === id))
                ? () => void handleDuplicateSelection()
                : undefined
            }
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

      {/* Connector-tool overlay — mounted only while a connector tool is
          armed, so it can capture the WHOLE drag-to-draw gesture in
          screen space regardless of whether it starts over empty canvas
          or on top of an existing object (which onNodePointerDown's own
          stopPropagation would otherwise swallow before it ever reached
          a plain background handler). */}
      {pendingConnectorTool && (
        <div
          className="absolute inset-0 z-30 cursor-crosshair"
          onPointerDown={onConnectorCreatePointerDown}
          onPointerMove={onConnectorCreatePointerMove}
          onPointerUp={() => void onConnectorCreatePointerUp()}
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
          onConnectorEditPointerMove(e);
        }}
        onPointerUp={() => {
          onBackgroundPointerUp();
          onResizeHandlePointerUp();
          onRotateHandlePointerUp();
          onConnectorEditPointerUp();
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
                  "transition-shadow duration-300 ease-out hover:shadow-[0_8px_18px_-8px_rgba(0,0,0,0.28)]",
                  selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
                style={{
                  left: 0,
                  top: 0,
                  width: pos.w,
                  height: pos.h,
                  zIndex: pos.zIndex,
                  // Position AND drag-tilt both ride in this one string —
                  // see nodeTransform's comment for why tilt isn't on the
                  // standalone `rotate` property. At rest (not being
                  // dragged) tilt is always 0.
                  transform: nodeTransform(pos.x, pos.y, 0),
                }}
              >
                <CanvasItemBody item={item} />
              </div>
            );
          })}

          {canvasObjectsState.map((obj) => {
            if (obj.type === "connector") return null; // rendered by ConnectorLayer below, not here
            const pos = positions[obj.id];
            if (!pos) return null;
            const ref: NodeRef = { kind: "object", id: obj.id };
            const selected = selectedIds.includes(obj.id);
            const showHandles = selected && selectedIds.length === 1;
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
                )}
                style={{
                  left: 0,
                  top: 0,
                  width: pos.w,
                  height: pos.h,
                  zIndex: pos.zIndex,
                  // Position, drag-tilt, and obj.rotation/flip (persisted,
                  // via the rotate handle) all ride in this one `transform`
                  // string — see nodeTransform's comment for why tilt isn't
                  // on the standalone `rotate` property. At rest (not being
                  // dragged) tilt is always 0. Flip is listed AFTER rotate
                  // on purpose: CSS applies the last-listed function to the
                  // object's own local coordinates first, so scaleX/scaleY
                  // mirror the shape in its own unrotated space and
                  // rotate() then carries that already-mirrored result
                  // around — flip and rotation stay independent of each
                  // other exactly like Figma's model, instead of an
                  // arrow's flip direction silently depending on whatever
                  // angle it's rotated to.
                  transform: nodeTransform(pos.x, pos.y, 0, canvasObjectTransform(obj)),
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

          {/* Connectors — a shared vector layer, always on top of every
              other object (drawn last), since each one is a real SVG
              path rather than a sized div like everything else here. No
              viewBox on this <svg> means 1 SVG user unit = 1 CSS px, so
              it inherits this wrapper's own pan/zoom transform for free
              — a connector's points are plain canvas-space numbers,
              drawn directly, with no extra per-connector coordinate
              math (see connectorPathD's comment). */}
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
            {canvasObjectsState
              .filter((o) => o.type === "connector")
              .map((obj) => {
                const points = resolveConnectorPoints(obj, positions);
                if (points.length < 2) return null;
                const els = getConnectorEls(obj.id);
                const selected = selectedIds.length === 1 && selectedIds[0] === obj.id;
                const stroke = obj.fill ?? "#3B5BDB";
                const d = connectorPathD(points);
                const startMarkerId = `connector-start-${obj.id}`;
                const endMarkerId = `connector-end-${obj.id}`;
                const isElbow = points.length === 3;
                return (
                  <g key={obj.id}>
                    <defs>
                      {obj.startDecoration === "arrow" && (
                        <marker
                          id={startMarkerId}
                          viewBox="0 0 10 10"
                          refX="8"
                          refY="5"
                          markerWidth={CONNECTOR_ARROWHEAD_SIZE}
                          markerHeight={CONNECTOR_ARROWHEAD_SIZE}
                          markerUnits="userSpaceOnUse"
                          orient="auto-start-reverse"
                        >
                          <path d="M0,0 L10,5 L0,10 Z" fill={stroke} />
                        </marker>
                      )}
                      {obj.endDecoration === "arrow" && (
                        <marker
                          id={endMarkerId}
                          viewBox="0 0 10 10"
                          refX="8"
                          refY="5"
                          markerWidth={CONNECTOR_ARROWHEAD_SIZE}
                          markerHeight={CONNECTOR_ARROWHEAD_SIZE}
                          markerUnits="userSpaceOnUse"
                          orient="auto"
                        >
                          <path d="M0,0 L10,5 L0,10 Z" fill={stroke} />
                        </marker>
                      )}
                    </defs>
                    {/* The visible line — thin, exactly what's drawn.
                        Arrowheads are markers on THIS path, generated
                        from its own geometry (orient="auto"/
                        "auto-start-reverse"), so they always match the
                        final segment's direction automatically, reverse
                        automatically if the connector's direction
                        reverses, and stay crisp at any zoom since
                        they're real vector geometry, not an icon/glyph. */}
                    <path
                      ref={(el) => {
                        els.path = el;
                      }}
                      d={d}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={CONNECTOR_STROKE_WIDTH}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      markerStart={obj.startDecoration === "arrow" ? `url(#${startMarkerId})` : undefined}
                      markerEnd={obj.endDecoration === "arrow" ? `url(#${endMarkerId})` : undefined}
                    />
                    {/* Invisible, much wider hit area — see the
                        CONNECTOR_HIT_STROKE_WIDTH comment: a bare 2.5px
                        line is genuinely hard to click, this makes
                        selecting/dragging a thin arrow easy without
                        changing how anything looks. Also IS the "drag
                        the whole connector" target. */}
                    <path
                      ref={(el) => {
                        els.hitPath = el;
                      }}
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={CONNECTOR_HIT_STROKE_WIDTH}
                      style={{ pointerEvents: "stroke", cursor: "pointer" }}
                      onPointerDown={(e) => onConnectorBodyPointerDown(e, obj)}
                    />
                    {selected && (
                      <>
                        {isElbow && (
                          <>
                            {/* Mid-segment drag handles — axis-constrained
                                (see processConnectorFrame's "segment"
                                branch): grabbing the horizontal segment
                                only ever drags it vertically and vice
                                versa, so the connector can never go
                                accidentally diagonal. */}
                            <line
                              ref={(el) => {
                                els.segHandles[0] = el;
                              }}
                              x1={points[0].x}
                              y1={points[0].y}
                              x2={points[1].x}
                              y2={points[1].y}
                              stroke="transparent"
                              strokeWidth={CONNECTOR_HIT_STROKE_WIDTH}
                              style={{
                                pointerEvents: "stroke",
                                cursor: elbowOrientation(points) === "h-first" ? "ns-resize" : "ew-resize",
                              }}
                              onPointerDown={(e) => onConnectorSegmentPointerDown(e, obj, 0)}
                            />
                            <line
                              ref={(el) => {
                                els.segHandles[1] = el;
                              }}
                              x1={points[1].x}
                              y1={points[1].y}
                              x2={points[2].x}
                              y2={points[2].y}
                              stroke="transparent"
                              strokeWidth={CONNECTOR_HIT_STROKE_WIDTH}
                              style={{
                                pointerEvents: "stroke",
                                cursor: elbowOrientation(points) === "h-first" ? "ew-resize" : "ns-resize",
                              }}
                              onPointerDown={(e) => onConnectorSegmentPointerDown(e, obj, 1)}
                            />
                          </>
                        )}
                        {/* Endpoint handles — sit directly on the actual
                            start/end points, not a bounding-box corner,
                            per the "selection UI follows the real
                            geometry" requirement. */}
                        {[points[0], points[points.length - 1]].map((p, i) => (
                          <circle
                            key={i}
                            ref={(el) => {
                              els.handles[i === 0 ? 0 : points.length - 1] = el;
                            }}
                            cx={p.x}
                            cy={p.y}
                            r={6}
                            fill="var(--background)"
                            stroke="var(--foreground)"
                            strokeWidth={2}
                            style={{ pointerEvents: "all", cursor: "crosshair" }}
                            onPointerDown={(e) => onConnectorHandlePointerDown(e, obj, i === 0 ? "start" : "end")}
                          />
                        ))}
                      </>
                    )}
                  </g>
                );
              })}
            {/* Live drag-to-create preview — same rendering as a real
                connector (including binding-snap behavior), just not
                backed by a stored object until the pointer is released. */}
            {connectorPreviewActive &&
              (() => {
                const els = getConnectorEls(PREVIEW_ID);
                const preset = pendingConnectorTool ? CONNECTOR_PRESETS[pendingConnectorTool] : null;
                if (!preset) return null;
                const previewMarkerId = "connector-preview-end";
                return (
                  <g>
                    {preset.endDecoration === "arrow" && (
                      <defs>
                        <marker
                          id={previewMarkerId}
                          viewBox="0 0 10 10"
                          refX="8"
                          refY="5"
                          markerWidth={CONNECTOR_ARROWHEAD_SIZE}
                          markerHeight={CONNECTOR_ARROWHEAD_SIZE}
                          markerUnits="userSpaceOnUse"
                          orient="auto"
                        >
                          <path d="M0,0 L10,5 L0,10 Z" fill="#3B5BDB" />
                        </marker>
                      </defs>
                    )}
                    <path
                      ref={(el) => {
                        els.path = el;
                      }}
                      fill="none"
                      stroke="#3B5BDB"
                      strokeWidth={CONNECTOR_STROKE_WIDTH}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="6 4"
                      markerEnd={preset.endDecoration === "arrow" ? `url(#${previewMarkerId})` : undefined}
                    />
                  </g>
                );
              })()}
            {/* Binding indicator — the 5 candidate anchors of whatever
                object a connector endpoint is currently hovering near,
                with the actually-snapped one highlighted. Only mounted
                while something's within snap range (see
                setHoverBindingIfChanged), so this never re-renders on
                every drag frame — just when the candidate changes. */}
            {hoverBinding &&
              (() => {
                const pos = positions[hoverBinding.objectId];
                if (!pos) return null;
                return (
                  <g className="pointer-events-none">
                    <rect
                      x={pos.x}
                      y={pos.y}
                      width={pos.w}
                      height={pos.h}
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      rx={6}
                    />
                    {CONNECTOR_ANCHORS.map((anchor) => {
                      const p = connectorAnchorPoint(pos, anchor);
                      const active = anchor === hoverBinding.anchor;
                      return (
                        <circle
                          key={anchor}
                          cx={p.x}
                          cy={p.y}
                          r={active ? 5 : 3}
                          fill={active ? "var(--primary)" : "var(--background)"}
                          stroke="var(--primary)"
                          strokeWidth={2}
                        />
                      );
                    })}
                  </g>
                );
              })()}
          </svg>
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
    // "line"/"arrow"/"elbow-arrow" used to render here as a box-shaped
    // stroke drawing — that's the whole box-not-geometry design this
    // session's connector rework replaced (see ConnectorLayer in the
    // main render). Nothing creates a shape with one of these variants
    // anymore (the toolbar's line/arrow/elbow options are gone, and
    // lib/local/canvas-objects.ts's migration converts any old stored
    // row to a real `type: "connector"` object the moment it's read) —
    // this is unreachable in practice, kept only because
    // CanvasShapeVariant's type still includes these values for that
    // migration code to type-check against.
    return null;
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
