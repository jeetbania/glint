import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { canvasObjects } from "@/db/schema";
import type { CreateCanvasObjectInput, UpdateCanvasObjectInput } from "@/lib/validation";

/** Everything drawn directly on a collection's canvas — sticky notes,
 * text, shapes, frames. See db/schema.ts for why these live in their own
 * table instead of as a fifth item type. */
export async function listCanvasObjects(collectionId: string) {
  const db = getDb();
  return db
    .select()
    .from(canvasObjects)
    .where(eq(canvasObjects.collectionId, collectionId));
}

export async function createCanvasObject(
  collectionId: string,
  input: CreateCanvasObjectInput,
) {
  const db = getDb();
  const [created] = await db
    .insert(canvasObjects)
    .values({ collectionId, ...input })
    .returning();
  return created;
}

/** Scoped by collectionId as well as id so one collection's canvas can
 * never patch/delete another's object by guessing a uuid. */
export async function updateCanvasObject(
  id: string,
  collectionId: string,
  patch: UpdateCanvasObjectInput,
) {
  const db = getDb();
  const [updated] = await db
    .update(canvasObjects)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(canvasObjects.id, id), eq(canvasObjects.collectionId, collectionId)))
    .returning();
  return updated ?? null;
}

export async function deleteCanvasObject(id: string, collectionId: string) {
  const db = getDb();
  await db
    .delete(canvasObjects)
    .where(and(eq(canvasObjects.id, id), eq(canvasObjects.collectionId, collectionId)));
}
