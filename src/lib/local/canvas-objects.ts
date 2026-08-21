import { getLocalDb, uuid, nowIso, type LocalCanvasObjectRow } from "@/lib/local/db";
import type { CreateCanvasObjectInput, UpdateCanvasObjectInput } from "@/lib/validation";

/** Padding (world px) added around a connector's raw points when
 * deriving its cached bounding box — endpoint handles and arrowheads
 * extend a little past the bare points, and the generic hit-testing
 * (marquee-select, frame-containment) that reads this box shouldn't clip
 * them. Purely cosmetic/hit-test padding; never affects the real
 * geometry in `points`. */
const CONNECTOR_BOUNDS_PADDING = 14;

/** The bounding box is ALWAYS derived from `points`, never the other way
 * around — this is the one place that conversion happens, called from
 * both createCanvasObject/updateCanvasObject below (so it's correct no
 * matter which layer writes a connector's points) and from
 * collection-canvas.tsx while a drag is live (so the on-screen box tracks
 * the geometry every frame, not just after a network round-trip). */
export function boundsForConnectorPoints(points: { x: number; y: number }[]): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs) - CONNECTOR_BOUNDS_PADDING;
  const minY = Math.min(...ys) - CONNECTOR_BOUNDS_PADDING;
  const maxX = Math.max(...xs) + CONNECTOR_BOUNDS_PADDING;
  const maxY = Math.max(...ys) + CONNECTOR_BOUNDS_PADDING;
  return { x: minX, y: minY, w: Math.max(maxX - minX, 1), h: Math.max(maxY - minY, 1) };
}

// Mirrors the column defaults in db/schema.ts's canvasObjects table.
const DEFAULTS = {
  text: null,
  shapeVariant: null,
  x: 0,
  y: 0,
  w: 220,
  h: 220,
  rotation: 0,
  flipX: false,
  flipY: false,
  zIndex: 0,
  fill: null,
  textColor: null,
  fontFamily: "sans",
  fontSize: 14,
  bold: false,
  italic: false,
  align: "left",
  points: null,
  connectorType: null,
  startDecoration: null,
  endDecoration: null,
  strokeStyle: null,
  startBinding: null,
  endBinding: null,
  locked: false,
} as const;

/** A pre-connector-system row: `type: "shape"` with shapeVariant one of
 * the old rectangle-with-an-arrow-drawn-inside-it representations. See
 * migrateLegacyShapeToConnector below. */
function isLegacyConnectorShape(
  row: LocalCanvasObjectRow,
): row is LocalCanvasObjectRow & { shapeVariant: "line" | "arrow" | "elbow-arrow" } {
  return (
    row.type === "shape" &&
    (row.shapeVariant === "line" || row.shapeVariant === "arrow" || row.shapeVariant === "elbow-arrow")
  );
}

/** Converts an old box-shaped line/arrow/elbow-arrow (x/y/w/h/rotation/
 * flip, with the arrow drawn as fixed local coordinates inside that box —
 * see the pre-connector-system CanvasObjectBody) into the new connector
 * model's actual world-space points, preserving its visual position and
 * angle exactly. Runs lazily, once, the first time an old row is read
 * (listCanvasObjects below persists the result so this never re-runs for
 * the same row) — existing canvases don't lose their arrows when this
 * ships. */
function migrateLegacyShapeToConnector(row: LocalCanvasObjectRow): LocalCanvasObjectRow {
  if (!isLegacyConnectorShape(row)) return row;
  const { x, y, w, h, rotation, flipX, flipY, shapeVariant } = row;
  const center = { x: w / 2, y: h / 2 };
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // local (pre-flip/rotate/translate) point -> final world point, in the
  // exact same order the live CSS transform used to compose them
  // (scale/flip first, in local space, then rotate, then translate).
  function toWorld(local: { x: number; y: number }): { x: number; y: number } {
    const mirrored = {
      x: flipX ? w - local.x : local.x,
      y: flipY ? h - local.y : local.y,
    };
    const dx = mirrored.x - center.x;
    const dy = mirrored.y - center.y;
    return {
      x: x + center.x + dx * cos - dy * sin,
      y: y + center.y + dx * sin + dy * cos,
    };
  }

  const localPoints =
    shapeVariant === "elbow-arrow"
      ? [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w, y: h },
        ]
      : [
          { x: 0, y: h / 2 },
          { x: w, y: h / 2 },
        ];
  const points = localPoints.map(toWorld);
  const bounds = boundsForConnectorPoints(points);

  return {
    ...row,
    type: "connector",
    shapeVariant: null,
    points,
    connectorType: shapeVariant === "elbow-arrow" ? "elbow" : "straight",
    startDecoration: "none",
    endDecoration: "arrow",
    strokeStyle: "solid",
    startBinding: null,
    endBinding: null,
    locked: false,
    rotation: 0,
    flipX: false,
    flipY: false,
    ...bounds,
  };
}

/** Rows written before strokeStyle/locked existed don't have them at all
 * (undefined, not null, in IndexedDB) — give every row a real value the
 * first time it's read, same lazy-migrate-and-persist approach as
 * migrateLegacyShapeToConnector above (and folded into the same pass so
 * a legacy shape only gets written back to IndexedDB once, not twice). */
function normalizeRow(row: LocalCanvasObjectRow): LocalCanvasObjectRow {
  const migrated = migrateLegacyShapeToConnector(row);
  if (migrated.strokeStyle != null && migrated.locked != null) return migrated;
  return {
    ...migrated,
    strokeStyle: migrated.strokeStyle ?? (migrated.type === "connector" ? "solid" : null),
    locked: migrated.locked ?? false,
  };
}

export async function listCanvasObjects(collectionId: string): Promise<LocalCanvasObjectRow[]> {
  const db = await getLocalDb();
  const rows = await db.getAllFromIndex("canvasObjects", "collectionId", collectionId);
  const migrated = rows.map(normalizeRow);
  const changed = migrated.filter((row, i) => row !== rows[i]);
  if (changed.length > 0) {
    const tx = db.transaction("canvasObjects", "readwrite");
    await Promise.all(changed.map((row) => tx.store.put(row)));
    await tx.done;
  }
  return migrated;
}

export async function createCanvasObject(
  collectionId: string,
  input: CreateCanvasObjectInput,
): Promise<LocalCanvasObjectRow> {
  const db = await getLocalDb();
  const ts = nowIso();
  const row: LocalCanvasObjectRow = {
    id: uuid(),
    collectionId,
    ...DEFAULTS,
    ...input,
    text: input.text ?? null,
    shapeVariant: input.shapeVariant ?? null,
    fill: input.fill ?? null,
    textColor: input.textColor ?? null,
    startBinding: input.startBinding ?? null,
    endBinding: input.endBinding ?? null,
    strokeStyle: input.strokeStyle ?? (input.type === "connector" ? "solid" : null),
    locked: input.locked ?? false,
    ...(input.points ? boundsForConnectorPoints(input.points) : null),
    createdAt: ts,
    updatedAt: ts,
  };
  await db.put("canvasObjects", row);
  return row;
}

export async function updateCanvasObject(
  id: string,
  collectionId: string,
  patch: UpdateCanvasObjectInput,
): Promise<LocalCanvasObjectRow | null> {
  const db = await getLocalDb();
  const existing = await db.get("canvasObjects", id);
  if (!existing || existing.collectionId !== collectionId) return null;
  const updated: LocalCanvasObjectRow = {
    ...existing,
    ...patch,
    ...(patch.points ? boundsForConnectorPoints(patch.points) : null),
    updatedAt: nowIso(),
  };
  await db.put("canvasObjects", updated);
  return updated;
}

export async function deleteCanvasObject(id: string, collectionId: string): Promise<void> {
  const db = await getLocalDb();
  const existing = await db.get("canvasObjects", id);
  if (!existing || existing.collectionId !== collectionId) return;
  await db.delete("canvasObjects", id);
}
