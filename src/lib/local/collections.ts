import { getLocalDb, uuid, nowIso, type LocalCollectionRow } from "@/lib/local/db";
import { slugify } from "@/lib/slug";
import { randomFolderHue, type FolderHue } from "@/lib/folder-color";

export type CollectionWithPreview = {
  id: string;
  name: string;
  slug: string;
  count: number;
  colorHue: number;
  previews: string[];
  hasNotesOrTasks: boolean;
  // The most recently-added link in this collection that has no scraped
  // OG image to show as a normal image preview (a lot of links never get
  // one — paywalled pages, sites that block the scraper, plain text
  // URLs). Without this a folder holding only such links showed no
  // preview at all; this mirrors hasNotesOrTasks's ghost-card fallback
  // but with enough of the link's own data to render the same
  // favicon+domain+title mini card used elsewhere (item-card.tsx's
  // LinkCardBody) instead of a generic placeholder.
  textLink: { url: string; domain: string | null; title: string | null; faviconUrl: string | null } | null;
};

export async function listCollectionsWithPreview(): Promise<CollectionWithPreview[]> {
  const db = await getLocalDb();
  const [cols, itemCols, items] = await Promise.all([
    db.getAll("collections"),
    db.getAll("itemCollections"),
    db.getAll("items"),
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));

  const withPreview = cols.map((col) => {
    const links = itemCols.filter((ic) => ic.collectionId === col.id);
    const activeLinks = links.filter((ic) => itemById.get(ic.itemId)?.status === "active");
    const hasNotesOrTasks = activeLinks.some((ic) => {
      const it = itemById.get(ic.itemId);
      return it?.type === "note" || it?.type === "task";
    });
    const sortedActiveItems = activeLinks
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((ic) => itemById.get(ic.itemId))
      .filter((it): it is NonNullable<typeof it> => !!it);
    const previews = sortedActiveItems
      .map((it) => it.blobUrl ?? it.previewImageUrl ?? null)
      .filter((v): v is string => !!v)
      .slice(0, 3);
    const textLinkItem = sortedActiveItems.find(
      (it) => it.type === "link" && !it.blobUrl && !it.previewImageUrl,
    );
    const textLink = textLinkItem
      ? {
          url: textLinkItem.url ?? "",
          domain: textLinkItem.domain ?? null,
          title: textLinkItem.title ?? null,
          faviconUrl: textLinkItem.faviconUrl ?? null,
        }
      : null;
    return {
      id: col.id,
      name: col.name,
      slug: col.slug,
      colorHue: col.colorHue ?? 176,
      count: activeLinks.length,
      previews,
      hasNotesOrTasks,
      textLink,
      updatedAt: col.updatedAt,
    };
  });

  return withPreview
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(({ updatedAt: _updatedAt, ...rest }) => rest);
}

export async function createCollection(name: string): Promise<LocalCollectionRow> {
  const db = await getLocalDb();
  const slug = slugify(name);
  const existing = await db.getFromIndex("collections", "slug", slug);
  if (existing) return existing;
  const ts = nowIso();
  const row: LocalCollectionRow = {
    id: uuid(),
    name,
    slug,
    colorHue: randomFolderHue(),
    createdAt: ts,
    updatedAt: ts,
  };
  await db.put("collections", row);
  return row;
}

export async function updateCollection(
  id: string,
  updates: { name?: string; colorHue?: FolderHue },
): Promise<LocalCollectionRow | null> {
  const db = await getLocalDb();
  const existing = await db.get("collections", id);
  if (!existing) return null;
  const updated: LocalCollectionRow = { ...existing, updatedAt: nowIso() };
  if (updates.name !== undefined) {
    updated.name = updates.name;
    updated.slug = slugify(updates.name);
  }
  if (updates.colorHue !== undefined) updated.colorHue = updates.colorHue;
  await db.put("collections", updated);
  return updated;
}

export async function deleteCollection(id: string): Promise<void> {
  const db = await getLocalDb();
  await db.delete("collections", id);
  const [itemCols, canvasObjs] = await Promise.all([
    db.getAllFromIndex("itemCollections", "collectionId", id),
    db.getAllFromIndex("canvasObjects", "collectionId", id),
  ]);
  const tx1 = db.transaction("itemCollections", "readwrite");
  await Promise.all(itemCols.map((ic) => tx1.store.delete(ic.id)));
  await tx1.done;
  const tx2 = db.transaction("canvasObjects", "readwrite");
  await Promise.all(canvasObjs.map((co) => tx2.store.delete(co.id)));
  await tx2.done;
}

export async function setItemCollections(itemId: string, names: string[]): Promise<void> {
  const db = await getLocalDb();
  const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))];

  const collectionIds: string[] = [];
  for (const name of cleaned) {
    const slug = slugify(name);
    const existing = await db.getFromIndex("collections", "slug", slug);
    if (existing) {
      const touched = { ...existing, updatedAt: nowIso() };
      await db.put("collections", touched);
      collectionIds.push(touched.id);
    } else {
      const ts = nowIso();
      const row: LocalCollectionRow = {
        id: uuid(),
        name,
        slug,
        colorHue: randomFolderHue(),
        createdAt: ts,
        updatedAt: ts,
      };
      await db.put("collections", row);
      collectionIds.push(row.id);
    }
  }

  const existingLinks = await db.getAllFromIndex("itemCollections", "itemId", itemId);
  const tx = db.transaction("itemCollections", "readwrite");
  await Promise.all(existingLinks.map((l) => tx.store.delete(l.id)));
  await tx.done;

  if (collectionIds.length > 0) {
    const ts = nowIso();
    const tx2 = db.transaction("itemCollections", "readwrite");
    await Promise.all(
      collectionIds.map((collectionId) =>
        tx2.store.put({
          id: `${itemId}:${collectionId}`,
          itemId,
          collectionId,
          x: null,
          y: null,
          w: null,
          h: null,
          zIndex: 0,
          parentId: null,
          flipX: false,
          flipY: false,
          createdAt: ts,
        }),
      ),
    );
    await tx2.done;
  }
}

export async function getCollectionBySlug(slug: string): Promise<LocalCollectionRow | null> {
  const db = await getLocalDb();
  return (await db.getFromIndex("collections", "slug", slug)) ?? null;
}

export type ItemCanvasMetaRow = {
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex: number;
  parentId: string | null;
  flipX: boolean;
  flipY: boolean;
};

export async function getItemPositionsForCollection(
  collectionId: string,
): Promise<Record<string, ItemCanvasMetaRow>> {
  const db = await getLocalDb();
  const rows = await db.getAllFromIndex("itemCollections", "collectionId", collectionId);
  const out: Record<string, ItemCanvasMetaRow> = {};
  for (const row of rows) {
    if (row.x == null || row.y == null || row.w == null || row.h == null) continue;
    out[row.itemId] = {
      x: row.x,
      y: row.y,
      w: row.w,
      h: row.h,
      zIndex: row.zIndex,
      parentId: row.parentId ?? null,
      flipX: row.flipX ?? false,
      flipY: row.flipY ?? false,
    };
  }
  return out;
}

export async function setItemPositionInCollection(
  collectionId: string,
  itemId: string,
  position: { x: number; y: number; w: number; h: number; zIndex: number; parentId?: string | null; flipX?: boolean; flipY?: boolean },
): Promise<void> {
  const db = await getLocalDb();
  const id = `${itemId}:${collectionId}`;
  const existing = await db.get("itemCollections", id);
  if (existing) {
    await db.put("itemCollections", { ...existing, ...position });
  } else {
    // Shouldn't normally happen (a position is only ever set for an
    // existing membership), but create the link rather than silently
    // dropping the write if it does.
    await db.put("itemCollections", {
      id,
      itemId,
      collectionId,
      parentId: null,
      flipX: false,
      flipY: false,
      ...position,
      createdAt: nowIso(),
    });
  }
}
