import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ApiItem } from "@/types/item";

/**
 * The whole point of this local-first layer: nothing here ever leaves
 * the browser it was created in. Every table below is the direct
 * IndexedDB analogue of a Postgres table in src/db/schema.ts — same
 * shape, same relationships, just stored per-device instead of in Neon.
 * See src/lib/local/api.ts for the thing that actually routes the app's
 * existing fetch("/api/...") calls here instead of over the network.
 */

/** Everything except the joined-in tags/collections, which get attached
 * at read time the same way lib/items.ts's attachTags() does. */
export type LocalItemRow = Omit<ApiItem, "tags" | "collections">;

export type LocalTagRow = { id: string; name: string; slug: string; color: string | null };

/** itemId+tagId compound key baked into `id` (`${itemId}:${tagId}`) so
 * "does this link already exist" is a single get(), not a scan. */
export type LocalItemTagRow = { id: string; itemId: string; tagId: string };

export type LocalCollectionRow = {
  id: string;
  name: string;
  slug: string;
  colorHue: number;
  createdAt: string;
  updatedAt: string;
};

/** Same compound-key trick as itemTags (`${itemId}:${collectionId}`) —
 * also carries the canvas x/y/w/h/zIndex placement, exactly like the
 * real item_collections table does (see db/schema.ts's comment on why
 * canvas position lives on the join row instead of a separate table). */
export type LocalItemCollectionRow = {
  id: string;
  itemId: string;
  collectionId: string;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  zIndex: number;
  createdAt: string;
};

export type LocalCanvasObjectRow = {
  id: string;
  collectionId: string;
  type: "sticky" | "text" | "shape" | "frame";
  text: string | null;
  shapeVariant: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  zIndex: number;
  fill: string | null;
  textColor: string | null;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: string;
  createdAt: string;
  updatedAt: string;
};

/** The actual image bytes for anything saved locally (paste, drop,
 * canvas "add image", the extension). Referenced from
 * LocalItemRow.blobUrl as `local-blob:<id>` — see local/blobs.ts for the
 * scheme and how it resolves to a real, renderable object URL. */
export type LocalBlobRow = { id: string; blob: Blob; mimeType: string; createdAt: string };

interface GlintLocalSchema extends DBSchema {
  items: {
    key: string;
    value: LocalItemRow;
    indexes: { type: string; status: string; createdAt: string };
  };
  tags: {
    key: string;
    value: LocalTagRow;
    indexes: { slug: string };
  };
  itemTags: {
    key: string;
    value: LocalItemTagRow;
    indexes: { itemId: string; tagId: string };
  };
  collections: {
    key: string;
    value: LocalCollectionRow;
    indexes: { slug: string };
  };
  itemCollections: {
    key: string;
    value: LocalItemCollectionRow;
    indexes: { itemId: string; collectionId: string };
  };
  canvasObjects: {
    key: string;
    value: LocalCanvasObjectRow;
    indexes: { collectionId: string };
  };
  blobs: {
    key: string;
    value: LocalBlobRow;
  };
}

const DB_NAME = "glint-local";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<GlintLocalSchema>> | null = null;

export function getLocalDb(): Promise<IDBPDatabase<GlintLocalSchema>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("Local storage is only available in the browser"),
    );
  }
  if (!dbPromise) {
    dbPromise = openDB<GlintLocalSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const items = db.createObjectStore("items", { keyPath: "id" });
        items.createIndex("type", "type");
        items.createIndex("status", "status");
        items.createIndex("createdAt", "createdAt");

        const tags = db.createObjectStore("tags", { keyPath: "id" });
        tags.createIndex("slug", "slug", { unique: true });

        const itemTags = db.createObjectStore("itemTags", { keyPath: "id" });
        itemTags.createIndex("itemId", "itemId");
        itemTags.createIndex("tagId", "tagId");

        const collections = db.createObjectStore("collections", { keyPath: "id" });
        collections.createIndex("slug", "slug", { unique: true });

        const itemCollections = db.createObjectStore("itemCollections", {
          keyPath: "id",
        });
        itemCollections.createIndex("itemId", "itemId");
        itemCollections.createIndex("collectionId", "collectionId");

        const canvasObjects = db.createObjectStore("canvasObjects", { keyPath: "id" });
        canvasObjects.createIndex("collectionId", "collectionId");

        db.createObjectStore("blobs", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Broadcasts to every other tab/window on this device that local data
 * changed, so an already-open tab notices a save made from the browser
 * extension (or another tab) without polling. Same-tab updates don't
 * need this — every write site already calls SWR's `mutate()` directly. */
const CHANNEL_NAME = "glint-local-db";
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function notifyLocalDbChanged(): void {
  getChannel()?.postMessage("changed");
}

export function onLocalDbChanged(handler: () => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = () => handler();
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}
