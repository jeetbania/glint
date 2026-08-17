import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import {
  items,
  itemTags,
  tags,
  itemCollections,
  collections,
  type ItemType,
  type ItemStatus,
} from "@/db/schema";
import { slugify } from "@/lib/slug";

export type ItemWithTags = typeof items.$inferSelect & {
  tags: { id: string; name: string; slug: string; color: string | null }[];
  collections: { id: string; name: string; slug: string }[];
};

export type ListItemsFilters = {
  /** One or more types to match (OR'd together) — a single-element array
   * behaves like the old singular `type` filter; multiple types (e.g.
   * ["image","link"]) power the Library's "visuals only" default view. */
  types?: ItemType[];
  status?: ItemStatus;
  tagSlug?: string;
  color?: string;
  collectionSlug?: string;
  q?: string;
  sort?: "recent-desc" | "recent-asc" | "name-asc";
  limit?: number;
  offset?: number;
};

/** Attach tags + collections to a list of items in bulk queries instead
 * of N+1. */
async function attachTags(
  rows: (typeof items.$inferSelect)[],
): Promise<ItemWithTags[]> {
  if (rows.length === 0) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const [tagRows, collectionRows] = await Promise.all([
    db
      .select({
        itemId: itemTags.itemId,
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        color: tags.color,
      })
      .from(itemTags)
      .innerJoin(tags, eq(itemTags.tagId, tags.id))
      .where(inArray(itemTags.itemId, ids)),
    db
      .select({
        itemId: itemCollections.itemId,
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
      })
      .from(itemCollections)
      .innerJoin(collections, eq(collections.id, itemCollections.collectionId))
      .where(inArray(itemCollections.itemId, ids)),
  ]);

  const tagsByItem = new Map<string, ItemWithTags["tags"]>();
  for (const t of tagRows) {
    const list = tagsByItem.get(t.itemId) ?? [];
    list.push({ id: t.id, name: t.name, slug: t.slug, color: t.color });
    tagsByItem.set(t.itemId, list);
  }

  const collectionsByItem = new Map<string, ItemWithTags["collections"]>();
  for (const c of collectionRows) {
    const list = collectionsByItem.get(c.itemId) ?? [];
    list.push({ id: c.id, name: c.name, slug: c.slug });
    collectionsByItem.set(c.itemId, list);
  }

  return rows.map((row) => ({
    ...row,
    tags: tagsByItem.get(row.id) ?? [],
    collections: collectionsByItem.get(row.id) ?? [],
  }));
}

export async function listItems(
  filters: ListItemsFilters = {},
): Promise<ItemWithTags[]> {
  const db = getDb();
  const conditions: SQL[] = [
    eq(items.status, filters.status ?? "active"),
  ];

  if (filters.types && filters.types.length > 0) {
    conditions.push(
      filters.types.length === 1
        ? eq(items.type, filters.types[0])
        : inArray(items.type, filters.types),
    );
  }
  if (filters.color) {
    conditions.push(sql`${filters.color} = ANY(${items.colorFamily})`);
  }
  if (filters.q && filters.q.trim()) {
    conditions.push(
      sql`${items.searchVector} @@ plainto_tsquery('english', ${filters.q.trim()})`,
    );
  }
  if (filters.tagSlug) {
    conditions.push(
      sql`${items.id} IN (
        SELECT ${itemTags.itemId} FROM ${itemTags}
        INNER JOIN ${tags} ON ${tags.id} = ${itemTags.tagId}
        WHERE ${tags.slug} = ${filters.tagSlug}
      )`,
    );
  }
  if (filters.collectionSlug) {
    conditions.push(
      sql`${items.id} IN (
        SELECT ${itemCollections.itemId} FROM ${itemCollections}
        INNER JOIN ${collections} ON ${collections.id} = ${itemCollections.collectionId}
        WHERE ${collections.slug} = ${filters.collectionSlug}
      )`,
    );
  }

  const orderBy = {
    "recent-desc": [desc(items.createdAt)],
    "recent-asc": [asc(items.createdAt)],
    "name-asc": [asc(items.title)],
  }[filters.sort ?? "recent-desc"];

  const rows = await db
    .select()
    .from(items)
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(filters.limit ?? 200)
    .offset(filters.offset ?? 0);

  return attachTags(rows);
}

export async function getItem(id: string): Promise<ItemWithTags | null> {
  const db = getDb();
  const [row] = await db.select().from(items).where(eq(items.id, id)).limit(1);
  if (!row) return null;
  const [withTags] = await attachTags([row]);
  return withTags;
}

export async function createItem(
  data: Partial<typeof items.$inferInsert> & { type: ItemType },
): Promise<typeof items.$inferSelect> {
  const db = getDb();
  const [row] = await db.insert(items).values(data).returning();
  return row;
}

export async function updateItem(
  id: string,
  data: Partial<typeof items.$inferInsert>,
): Promise<typeof items.$inferSelect | null> {
  const db = getDb();
  const [row] = await db
    .update(items)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(items.id, id))
    .returning();
  return row ?? null;
}

export async function deleteItem(id: string): Promise<void> {
  const db = getDb();
  // Soft delete keeps color/tag stats and search history recoverable;
  // hard delete of the row cascades item_tags/item_positions/kanban_cards.
  await db.update(items).set({ status: "trashed" }).where(eq(items.id, id));
}

/** Get-or-create tags by name and replace an item's tag set with them.
 * One bulk upsert instead of a select-then-maybe-insert per tag — the
 * old loop meant saving N tags cost up to 2N+2 sequential DB round
 * trips, which is exactly the kind of thing that reads as "the app is
 * slow" against a network-latency-bound serverless Postgres driver. The
 * `onConflictDoUpdate` with a no-op-ish SET is a standard Postgres
 * upsert trick to get every row (both freshly inserted and pre-existing)
 * back via a single RETURNING, in one round trip. */
export async function setItemTags(
  itemId: string,
  tagNames: string[],
): Promise<void> {
  const db = getDb();
  const cleaned = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))];
  const values = cleaned
    .map((name) => ({ name, slug: slugify(name) }))
    .filter((v) => v.slug);

  let tagIds: string[] = [];
  if (values.length > 0) {
    const upserted = await db
      .insert(tags)
      .values(values)
      .onConflictDoUpdate({
        target: tags.slug,
        set: { slug: sql`excluded.slug` },
      })
      .returning();
    tagIds = upserted.map((t) => t.id);
  }

  await db.delete(itemTags).where(eq(itemTags.itemId, itemId));
  if (tagIds.length > 0) {
    await db
      .insert(itemTags)
      .values(tagIds.map((tagId) => ({ itemId, tagId })))
      .onConflictDoNothing();
  }
}

export async function listTagsWithCounts() {
  const db = getDb();
  return db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      color: tags.color,
      // Count only active items — a tag whose items were all deleted
      // should read 0, not linger with a stale count from trashed rows.
      count: sql<number>`count(${items.id}) filter (where ${items.status} = 'active')::int`,
    })
    .from(tags)
    .leftJoin(itemTags, eq(itemTags.tagId, tags.id))
    .leftJoin(items, eq(items.id, itemTags.itemId))
    .groupBy(tags.id)
    .orderBy(desc(sql`count(${items.id}) filter (where ${items.status} = 'active')`));
}

export async function listColorFamilyCounts() {
  const db = getDb();
  const rows = await db.execute<{ color: string; count: number }>(sql`
    SELECT unnest(color_family) AS color, count(*)::int AS count
    FROM items
    WHERE status = 'active'
    GROUP BY color
    ORDER BY count DESC
  `);
  return rows.rows;
}
