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
 * with them — mirrors setItemTags in lib/items.ts. */
export async function setItemCollections(
  itemId: string,
  names: string[],
): Promise<void> {
  const db = getDb();
  const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))];

  const collectionIds: string[] = [];
  for (const name of cleaned) {
    const created = await createCollection(name);
    // Touch updatedAt so recently-used collections float to the top of
    // the glass-folder row, even when get-or-create hit the existing row.
    await db
      .update(collections)
      .set({ updatedAt: new Date() })
      .where(eq(collections.id, created.id));
    collectionIds.push(created.id);
  }

  await db.delete(itemCollections).where(eq(itemCollections.itemId, itemId));
  if (collectionIds.length > 0) {
    await db
      .insert(itemCollections)
      .values(collectionIds.map((collectionId) => ({ itemId, collectionId })));
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
