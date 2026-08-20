import { notifyLocalDbChanged } from "@/lib/local/db";
import * as localItems from "@/lib/local/items";
import * as localCollections from "@/lib/local/collections";
import * as localCanvasObjects from "@/lib/local/canvas-objects";
import {
  createItemSchema,
  listItemsQuerySchema,
  updateItemSchema,
  createCollectionSchema,
  updateCollectionSchema,
  setItemPositionSchema,
  createCanvasObjectSchema,
  updateCanvasObjectSchema,
} from "@/lib/validation";
import type { FolderHue } from "@/lib/folder-color";

/**
 * A same-origin, in-browser router that mimics the exact request/response
 * contract of src/app/api/**'s Next.js route handlers, backed by
 * IndexedDB (src/lib/local/*) instead of Postgres+Blob. Every component
 * that used to call fetch("/api/items"), etc. now calls localFetch()
 * with the identical URL/method/body — this is the ONLY thing that
 * changed; the validation, the shapes, the SWR keys, the mutate() calls
 * scattered through the app all still make sense unmodified.
 *
 * Anything this router doesn't recognize (/api/link-preview, which is a
 * stateless read-only proxy with nothing to store, or anything future)
 * falls through to a real network fetch() — see the bottom of this file.
 */
export async function localFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = new URL(input, "http://local");
  const path = url.pathname;
  const method = (init?.method ?? "GET").toUpperCase();

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const parseBody = () => {
    try {
      return init?.body ? JSON.parse(init.body as string) : null;
    } catch {
      return null;
    }
  };

  try {
    // ---- /api/items ---------------------------------------------------
    if (path === "/api/items" && method === "GET") {
      const parsed = listItemsQuerySchema.safeParse(
        Object.fromEntries(url.searchParams),
      );
      if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
      const { type, tag, color, collection, q, sort, limit, offset } = parsed.data;
      const items = await localItems.listItems({
        types: type,
        tagSlug: tag,
        color,
        collectionSlug: collection,
        q,
        sort,
        limit,
        offset,
      });
      return json({ items });
    }

    if (path === "/api/items" && method === "POST") {
      const parsed = createItemSchema.safeParse(parseBody());
      if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
      const input = parsed.data;
      const item = await localItems.createItem(input);
      notifyLocalDbChanged();

      // Mirrors the server route's Next `after()`: respond immediately
      // with the bare-URL card, enrich with OG metadata once the real
      // (still-networked, stateless) /api/link-preview call resolves.
      if (input.type === "link") {
        void enrichLinkItem(item.id, input.url);
      }
      return json({ item }, 201);
    }

    const itemMatch = path.match(/^\/api\/items\/([^/]+)$/);
    if (itemMatch) {
      const id = itemMatch[1];
      if (method === "GET") {
        const item = await localItems.getItem(id);
        if (!item) return json({ error: "Not found" }, 404);
        return json({ item });
      }
      if (method === "PATCH") {
        const parsed = updateItemSchema.safeParse(parseBody());
        if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
        const { tags, collections, ...fields } = parsed.data;
        if (Object.keys(fields).length > 0) await localItems.updateItem(id, fields);
        if (tags) await localItems.setItemTags(id, tags);
        if (collections) await localCollections.setItemCollections(id, collections);
        const item = await localItems.getItem(id);
        if (!item) return json({ error: "Not found" }, 404);
        notifyLocalDbChanged();
        return json({ item });
      }
      if (method === "DELETE") {
        await localItems.deleteItem(id);
        notifyLocalDbChanged();
        return json({ ok: true });
      }
    }

    // ---- /api/collections ----------------------------------------------
    if (path === "/api/collections" && method === "GET") {
      const collections = await localCollections.listCollectionsWithPreview();
      return json({ collections });
    }
    if (path === "/api/collections" && method === "POST") {
      const parsed = createCollectionSchema.safeParse(parseBody());
      if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
      const collection = await localCollections.createCollection(parsed.data.name);
      notifyLocalDbChanged();
      return json({ collection }, 201);
    }

    const collectionSlugMatch = path.match(/^\/api\/collections\/([^/]+)$/);
    if (collectionSlugMatch) {
      const slug = collectionSlugMatch[1];
      if (method === "GET") {
        const collection = await localCollections.getCollectionBySlug(slug);
        if (!collection) return json({ error: "Not found" }, 404);
        const [items, positions, canvasObjects] = await Promise.all([
          localItems.listItems({ collectionSlug: slug, sort: "recent-desc" }),
          localCollections.getItemPositionsForCollection(collection.id),
          localCanvasObjects.listCanvasObjects(collection.id),
        ]);
        return json({ collection, items, positions, canvasObjects });
      }
      if (method === "PATCH") {
        const existing = await localCollections.getCollectionBySlug(slug);
        if (!existing) return json({ error: "Not found" }, 404);
        const parsed = updateCollectionSchema.safeParse(parseBody());
        if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
        const collection = await localCollections.updateCollection(existing.id, {
          name: parsed.data.name,
          colorHue: parsed.data.colorHue as FolderHue | undefined,
        });
        notifyLocalDbChanged();
        return json({ collection });
      }
      if (method === "DELETE") {
        const existing = await localCollections.getCollectionBySlug(slug);
        if (!existing) return json({ error: "Not found" }, 404);
        await localCollections.deleteCollection(existing.id);
        notifyLocalDbChanged();
        return json({ ok: true });
      }
    }

    const positionMatch = path.match(/^\/api\/collections\/([^/]+)\/items\/([^/]+)$/);
    if (positionMatch && method === "PATCH") {
      const [, slug, itemId] = positionMatch;
      const collection = await localCollections.getCollectionBySlug(slug);
      if (!collection) return json({ error: "Not found" }, 404);
      const parsed = setItemPositionSchema.safeParse(parseBody());
      if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
      await localCollections.setItemPositionInCollection(collection.id, itemId, parsed.data);
      notifyLocalDbChanged();
      return json({ ok: true });
    }

    const canvasObjectsMatch = path.match(/^\/api\/collections\/([^/]+)\/canvas-objects$/);
    if (canvasObjectsMatch) {
      const slug = canvasObjectsMatch[1];
      const collection = await localCollections.getCollectionBySlug(slug);
      if (!collection) return json({ error: "Not found" }, 404);
      if (method === "GET") {
        const canvasObjects = await localCanvasObjects.listCanvasObjects(collection.id);
        return json({ canvasObjects });
      }
      if (method === "POST") {
        const parsed = createCanvasObjectSchema.safeParse(parseBody());
        if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
        const canvasObject = await localCanvasObjects.createCanvasObject(
          collection.id,
          parsed.data,
        );
        notifyLocalDbChanged();
        return json({ canvasObject }, 201);
      }
    }

    const canvasObjectMatch = path.match(
      /^\/api\/collections\/([^/]+)\/canvas-objects\/([^/]+)$/,
    );
    if (canvasObjectMatch) {
      const [, slug, id] = canvasObjectMatch;
      const collection = await localCollections.getCollectionBySlug(slug);
      if (!collection) return json({ error: "Not found" }, 404);
      if (method === "PATCH") {
        const parsed = updateCanvasObjectSchema.safeParse(parseBody());
        if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
        const canvasObject = await localCanvasObjects.updateCanvasObject(
          id,
          collection.id,
          parsed.data,
        );
        if (!canvasObject) return json({ error: "Not found" }, 404);
        notifyLocalDbChanged();
        return json({ canvasObject });
      }
      if (method === "DELETE") {
        await localCanvasObjects.deleteCanvasObject(id, collection.id);
        notifyLocalDbChanged();
        return json({ ok: true });
      }
    }

    // ---- /api/tags, /api/colors -----------------------------------------
    if (path === "/api/tags" && method === "GET") {
      const tags = (await localItems.listTagsWithCounts()).filter((t) => t.count > 0);
      return json({ tags });
    }
    if (path === "/api/colors" && method === "GET") {
      const colors = await localItems.listColorFamilyCounts();
      return json({ colors });
    }
  } catch (error) {
    console.error("[local-api]", method, path, error);
    return json({ error: "Local storage error" }, 500);
  }

  // Not one of ours (e.g. /api/link-preview — stateless, still real
  // network) — pass straight through to the real fetch.
  return fetch(input, init);
}

async function enrichLinkItem(itemId: string, url: string) {
  try {
    const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
    if (!res.ok) return;
    const meta = await res.json();
    const current = await localItems.getItem(itemId);
    if (!current) return;
    await localItems.updateItem(itemId, {
      title: current.title ?? meta.title ?? null,
      domain: meta.domain ?? null,
      faviconUrl: meta.faviconUrl ?? null,
      previewImageUrl: meta.previewImageUrl ?? null,
      bodyText: meta.description ?? null,
    });
    notifyLocalDbChanged();
  } catch (error) {
    console.error("[local-api] link enrichment failed", error);
  }
}
