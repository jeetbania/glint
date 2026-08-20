import { getLocalDb, uuid, nowIso, type LocalItemRow } from "@/lib/local/db";
import { slugify } from "@/lib/slug";
import { deleteBlob, isLocalBlobRef, localBlobId } from "@/lib/local/blobs";
import type { ApiItem, ApiTag, ApiCollection, ItemType } from "@/types/item";

/** Local twin of lib/items.ts's attachTags — joins tags + collections
 * onto a batch of item rows in bulk instead of N+1 lookups. */
async function attachJoins(
  db: Awaited<ReturnType<typeof getLocalDb>>,
  rows: LocalItemRow[],
): Promise<ApiItem[]> {
  if (rows.length === 0) return [];
  const ids = new Set(rows.map((r) => r.id));

  const [allItemTags, allItemCollections] = await Promise.all([
    db.getAll("itemTags"),
    db.getAll("itemCollections"),
  ]);

  const relevantItemTags = allItemTags.filter((it) => ids.has(it.itemId));
  const relevantItemCollections = allItemCollections.filter((ic) => ids.has(ic.itemId));

  const [tagRows, collectionRows] = await Promise.all([
    Promise.all([...new Set(relevantItemTags.map((it) => it.tagId))].map((id) => db.get("tags", id))),
    Promise.all(
      [...new Set(relevantItemCollections.map((ic) => ic.collectionId))].map((id) =>
        db.get("collections", id),
      ),
    ),
  ]);
  const tagById = new Map(tagRows.filter((t) => !!t).map((t) => [t.id, t]));
  const collectionById = new Map(collectionRows.filter((c) => !!c).map((c) => [c.id, c]));

  const tagsByItem = new Map<string, ApiTag[]>();
  for (const it of relevantItemTags) {
    const tag = tagById.get(it.tagId);
    if (!tag) continue;
    const list = tagsByItem.get(it.itemId) ?? [];
    list.push({ id: tag.id, name: tag.name, slug: tag.slug, color: tag.color });
    tagsByItem.set(it.itemId, list);
  }

  const collectionsByItem = new Map<string, ApiCollection[]>();
  for (const ic of relevantItemCollections) {
    const collection = collectionById.get(ic.collectionId);
    if (!collection) continue;
    const list = collectionsByItem.get(ic.itemId) ?? [];
    list.push({ id: collection.id, name: collection.name, slug: collection.slug });
    collectionsByItem.set(ic.itemId, list);
  }

  return rows.map((row) => ({
    ...row,
    tags: tagsByItem.get(row.id) ?? [],
    collections: collectionsByItem.get(row.id) ?? [],
  }));
}

export type ListItemsFilters = {
  types?: ItemType[];
  status?: "active" | "archived" | "trashed";
  tagSlug?: string;
  color?: string;
  collectionSlug?: string;
  q?: string;
  sort?: "recent-desc" | "recent-asc" | "name-asc";
  limit?: number;
  offset?: number;
};

export async function listItems(filters: ListItemsFilters = {}): Promise<ApiItem[]> {
  const db = await getLocalDb();
  let rows = await db.getAll("items");
  const status = filters.status ?? "active";
  rows = rows.filter((r) => r.status === status);

  if (filters.types && filters.types.length > 0) {
    const set = new Set(filters.types);
    rows = rows.filter((r) => set.has(r.type));
  }
  if (filters.color) {
    rows = rows.filter((r) => r.colorFamily?.includes(filters.color!));
  }
  if (filters.q && filters.q.trim()) {
    // Client-side substring search over the same fields the old
    // Postgres tsvector indexed (title/bodyText/url/domain) — no FTS
    // ranking, just "does it contain the query," which is plenty for a
    // personal library measured in the hundreds/low thousands of items.
    const q = filters.q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.title?.toLowerCase().includes(q) ||
        r.bodyText?.toLowerCase().includes(q) ||
        r.url?.toLowerCase().includes(q) ||
        r.domain?.toLowerCase().includes(q),
    );
  }
  if (filters.tagSlug) {
    const tag = await db.getFromIndex("tags", "slug", filters.tagSlug);
    const idSet = tag
      ? new Set((await db.getAllFromIndex("itemTags", "tagId", tag.id)).map((it) => it.itemId))
      : new Set<string>();
    rows = rows.filter((r) => idSet.has(r.id));
  }
  if (filters.collectionSlug) {
    const collection = await db.getFromIndex("collections", "slug", filters.collectionSlug);
    const idSet = collection
      ? new Set(
          (await db.getAllFromIndex("itemCollections", "collectionId", collection.id)).map(
            (ic) => ic.itemId,
          ),
        )
      : new Set<string>();
    rows = rows.filter((r) => idSet.has(r.id));
  }

  const sort = filters.sort ?? "recent-desc";
  rows = [...rows].sort((a, b) => {
    if (sort === "name-asc") return (a.title ?? "").localeCompare(b.title ?? "");
    if (sort === "recent-asc")
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 200;
  rows = rows.slice(offset, offset + limit);

  return attachJoins(db, rows);
}

export async function getItem(id: string): Promise<ApiItem | null> {
  const db = await getLocalDb();
  const row = await db.get("items", id);
  if (!row) return null;
  const [withJoins] = await attachJoins(db, [row]);
  return withJoins;
}

export type CreateItemInput =
  | {
      type: "image";
      title?: string;
      blobUrl: string;
      blobPathname: string;
      width?: number;
      height?: number;
      fileSizeBytes?: number;
      mimeType?: string;
      dominantColors?: { hex: string; percentage: number }[];
      colorFamily?: string[];
    }
  | { type: "link"; url: string; title?: string }
  | { type: "note"; title?: string; bodyText?: string; bodyJson?: unknown }
  | { type: "task"; title: string; bodyText?: string };

export async function createItem(input: CreateItemInput): Promise<ApiItem> {
  const db = await getLocalDb();
  const ts = nowIso();
  const row: LocalItemRow = {
    id: uuid(),
    type: input.type,
    title: null,
    bodyText: null,
    bodyJson: null,
    url: null,
    domain: null,
    faviconUrl: null,
    previewImageUrl: null,
    blobUrl: null,
    blobPathname: null,
    width: null,
    height: null,
    fileSizeBytes: null,
    mimeType: null,
    dominantColors: null,
    colorFamily: null,
    aiTags: null,
    aiCategory: null,
    aiStatus: "disabled",
    ocrText: null,
    status: "active",
    completed: false,
    createdAt: ts,
    updatedAt: ts,
  };

  if (input.type === "image") {
    row.title = input.title ?? null;
    row.blobUrl = input.blobUrl;
    row.blobPathname = input.blobPathname;
    row.width = input.width ?? null;
    row.height = input.height ?? null;
    row.fileSizeBytes = input.fileSizeBytes ?? null;
    row.mimeType = input.mimeType ?? null;
    row.dominantColors = input.dominantColors ?? null;
    row.colorFamily = input.colorFamily ?? null;
  } else if (input.type === "link") {
    row.url = input.url;
    row.title = input.title ?? null;
  } else if (input.type === "note") {
    row.title = input.title ?? null;
    row.bodyText = input.bodyText ?? null;
    row.bodyJson = input.bodyJson ?? null;
  } else {
    row.title = input.title;
    row.bodyText = input.bodyText ?? null;
  }

  await db.put("items", row);
  return { ...row, tags: [], collections: [] };
}

export async function updateItem(
  id: string,
  patch: Partial<LocalItemRow>,
): Promise<ApiItem | null> {
  const db = await getLocalDb();
  const existing = await db.get("items", id);
  if (!existing) return null;
  const updated: LocalItemRow = { ...existing, ...patch, updatedAt: nowIso() };
  await db.put("items", updated);
  const [withJoins] = await attachJoins(db, [updated]);
  return withJoins;
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getLocalDb();
  const existing = await db.get("items", id);
  if (!existing) return;
  // Soft delete, same as the server version — recoverable in principle,
  // and keeps tag/color counts honest without a real trash UI yet.
  await db.put("items", { ...existing, status: "trashed", updatedAt: nowIso() });
}

/** Hard-deletes a trashed item's row and its actual image bytes — not
 * currently wired to any UI (there's no trash view), but here so a
 * future one doesn't have to invent the blob-cleanup step: the old
 * server never had this at all (orphaned Blob files were never cleaned
 * up), which mattered a lot less on someone else's disk than it does on
 * the user's own. */
export async function purgeItem(id: string): Promise<void> {
  const db = await getLocalDb();
  const existing = await db.get("items", id);
  if (!existing) return;
  if (existing.blobUrl && isLocalBlobRef(existing.blobUrl)) {
    await deleteBlob(localBlobId(existing.blobUrl));
  }
  await db.delete("items", id);
  const links = await db.getAllFromIndex("itemTags", "itemId", id);
  const tx = db.transaction("itemTags", "readwrite");
  await Promise.all(links.map((l) => tx.store.delete(l.id)));
  await tx.done;
  const collectionLinks = await db.getAllFromIndex("itemCollections", "itemId", id);
  const tx2 = db.transaction("itemCollections", "readwrite");
  await Promise.all(collectionLinks.map((l) => tx2.store.delete(l.id)));
  await tx2.done;
}

export async function setItemTags(itemId: string, tagNames: string[]): Promise<void> {
  const db = await getLocalDb();
  const cleaned = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))];

  const tagIds: string[] = [];
  for (const name of cleaned) {
    const slug = slugify(name);
    if (!slug) continue;
    const existing = await db.getFromIndex("tags", "slug", slug);
    if (existing) {
      tagIds.push(existing.id);
    } else {
      const tag = { id: uuid(), name, slug, color: null };
      await db.put("tags", tag);
      tagIds.push(tag.id);
    }
  }

  const existingLinks = await db.getAllFromIndex("itemTags", "itemId", itemId);
  const tx = db.transaction("itemTags", "readwrite");
  await Promise.all(existingLinks.map((l) => tx.store.delete(l.id)));
  await tx.done;

  if (tagIds.length > 0) {
    const tx2 = db.transaction("itemTags", "readwrite");
    await Promise.all(
      tagIds.map((tagId) => tx2.store.put({ id: `${itemId}:${tagId}`, itemId, tagId })),
    );
    await tx2.done;
  }
}

export async function listTagsWithCounts() {
  const db = await getLocalDb();
  const [allTags, allItemTags, allItems] = await Promise.all([
    db.getAll("tags"),
    db.getAll("itemTags"),
    db.getAll("items"),
  ]);
  const activeItemIds = new Set(allItems.filter((i) => i.status === "active").map((i) => i.id));
  const countByTag = new Map<string, number>();
  for (const it of allItemTags) {
    if (!activeItemIds.has(it.itemId)) continue;
    countByTag.set(it.tagId, (countByTag.get(it.tagId) ?? 0) + 1);
  }
  return allTags
    .map((t) => ({ ...t, count: countByTag.get(t.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);
}

export async function listColorFamilyCounts() {
  const db = await getLocalDb();
  const allItems = await db.getAll("items");
  const counts = new Map<string, number>();
  for (const item of allItems) {
    if (item.status !== "active" || !item.colorFamily) continue;
    for (const color of item.colorFamily) counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([color, count]) => ({ color, count }))
    .sort((a, b) => b.count - a.count);
}
