import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { collections, itemCollections, items } from "@/db/schema";
import { slugify } from "@/lib/slug";

export type CollectionWithPreview = {
  id: string;
  name: string;
  slug: string;
  count: number;
  previews: string[];
};

/** Collections with a member count and up to 3 preview thumbnails (most
 * recently added active items with a visual), for the glass folder tiles. */
export async function listCollectionsWithPreview(): Promise<
  CollectionWithPreview[]
> {
  const db = getDb();

  const rows = await db
    .select({
      id: collections.id,
      name: collections.name,
      slug: collections.slug,
      count: sql<number>`count(${itemCollections.itemId}) filter (where ${items.status} = 'active')::int`,
    })
    .from(collections)
    .leftJoin(itemCollections, eq(itemCollections.collectionId, collections.id))
    .leftJoin(items, eq(items.id, itemCollections.itemId))
    .groupBy(collections.id)
    .orderBy(desc(collections.updatedAt));

  const previewRows = await db
    .select({
      collectionId: itemCollections.collectionId,
      thumbnail: sql<
        string | null
      >`coalesce(${items.blobUrl}, ${items.previewImageUrl})`,
      createdAt: itemCollections.createdAt,
    })
    .from(itemCollections)
    .innerJoin(items, eq(items.id, itemCollections.itemId))
    .where(
      and(
        eq(items.status, "active"),
        sql`coalesce(${items.blobUrl}, ${items.previewImageUrl}) is not null`,
      ),
    )
    .orderBy(desc(itemCollections.createdAt));

  const previewsByCollection = new Map<string, string[]>();
  for (const row of previewRows) {
    if (!row.thumbnail) continue;
    const list = previewsByCollection.get(row.collectionId) ?? [];
    if (list.length < 3) {
      list.push(row.thumbnail);
      previewsByCollection.set(row.collectionId, list);
    }
  }

  return rows.map((row) => ({
    ...row,
    previews: previewsByCollection.get(row.id) ?? [],
  }));
}

export async function createCollection(name: string) {
  const db = getDb();
  const slug = slugify(name);
  const [existing] = await db
    .select()
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);
  if (existing) return existing;

  const [created] = await db.insert(collections).values({ name, slug }).returning();
  return created;
}

export async function renameCollection(id: string, name: string) {
  const db = getDb();
  const [updated] = await db
    .update(collections)
    .set({ name, slug: slugify(name), updatedAt: new Date() })
    .where(eq(collections.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteCollection(id: string) {
  const db = getDb();
  await db.delete(collections).where(eq(collections.id, id));
}

/** Get-or-create collections by name and replace an item's membership set
 * with them — mirrors setItemTags in lib/items.ts. One bulk upsert
 * instead of a select/insert/update trio per collection: the old loop
 * cost up to 3N+2 sequential round trips for N collections, which is
 * exactly the kind of thing that reads as "the app is slow" against a
 * network-latency-bound serverless Postgres driver. The `updatedAt: now()`
 * in the conflict branch also folds in the old separate "touch recently
 * used" update for free. */
export async function setItemCollections(
  itemId: string,
  names: string[],
): Promise<void> {
  const db = getDb();
  const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const values = cleaned.map((name) => ({ name, slug: slugify(name) }));

  let collectionIds: string[] = [];
  if (values.length > 0) {
    const upserted = await db
      .insert(collections)
      .values(values)
      .onConflictDoUpdate({
        target: collections.slug,
        set: { updatedAt: new Date() },
      })
      .returning();
    collectionIds = upserted.map((c) => c.id);
  }

  await db.delete(itemCollections).where(eq(itemCollections.itemId, itemId));
  if (collectionIds.length > 0) {
    await db
      .insert(itemCollections)
      .values(collectionIds.map((collectionId) => ({ itemId, collectionId })))
      .onConflictDoNothing();
  }
}

export async function getItemCollectionNames(itemId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ name: collections.name })
    .from(itemCollections)
    .innerJoin(collections, eq(collections.id, itemCollections.collectionId))
    .where(eq(itemCollections.itemId, itemId));
  return rows.map((r) => r.name);
}

export async function getCollectionBySlug(slug: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);
  return row ?? null;
}

/** Item -> canvas placement, for a single collection. Nullable per-item
 * (see schema comment) — the canvas fills in an auto-arranged spot on the
 * client for anything that comes back null, and only persists here once
 * the user actually drags a card. */
export async function getItemPositionsForCollection(
  collectionId: string,
): Promise<Record<string, { x: number; y: number; w: number; h: number; zIndex: number }>> {
  const db = getDb();
  const rows = await db
    .select({
      itemId: itemCollections.itemId,
      x: itemCollections.x,
      y: itemCollections.y,
      w: itemCollections.w,
      h: itemCollections.h,
      zIndex: itemCollections.zIndex,
    })
    .from(itemCollections)
    .where(eq(itemCollections.collectionId, collectionId));

  const out: Record<string, { x: number; y: number; w: number; h: number; zIndex: number }> = {};
  for (const row of rows) {
    if (row.x == null || row.y == null || row.w == null || row.h == null) continue;
    out[row.itemId] = { x: row.x, y: row.y, w: row.w, h: row.h, zIndex: row.zIndex };
  }
  return out;
}

export async function setItemPositionInCollection(
  collectionId: string,
  itemId: string,
  position: { x: number; y: number; w: number; h: number; zIndex: number },
) {
  const db = getDb();
  await db
    .update(itemCollections)
    .set(position)
    .where(
      and(
        eq(itemCollections.collectionId, collectionId),
        eq(itemCollections.itemId, itemId),
      ),
    );
}
