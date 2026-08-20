import { getLocalDb, uuid, nowIso, type LocalCanvasObjectRow } from "@/lib/local/db";
import type { CreateCanvasObjectInput, UpdateCanvasObjectInput } from "@/lib/validation";

export async function listCanvasObjects(collectionId: string): Promise<LocalCanvasObjectRow[]> {
  const db = await getLocalDb();
  return db.getAllFromIndex("canvasObjects", "collectionId", collectionId);
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
} as const;

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
  const updated: LocalCanvasObjectRow = { ...existing, ...patch, updatedAt: nowIso() };
  await db.put("canvasObjects", updated);
  return updated;
}

export async function deleteCanvasObject(id: string, collectionId: string): Promise<void> {
  const db = await getLocalDb();
  const existing = await db.get("canvasObjects", id);
  if (!existing || existing.collectionId !== collectionId) return;
  await db.delete("canvasObjects", id);
}
