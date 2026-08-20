import { useEffect, useState } from "react";
import { getLocalDb, uuid, nowIso } from "@/lib/local/db";

/** The whole reason this app stopped uploading images to Vercel Blob:
 * image bytes now live only in this browser's IndexedDB. An item's
 * `blobUrl` field holds `local-blob:<id>` instead of a real https://
 * URL — resolveBlobSrc() turns that into an actual object URL a browser
 * can render, on demand, per session (object URLs don't survive a
 * reload, so they can't be persisted — only the reference can). */
export const LOCAL_BLOB_PREFIX = "local-blob:";

export function isLocalBlobRef(src: string | null | undefined): src is string {
  return !!src && src.startsWith(LOCAL_BLOB_PREFIX);
}

export function localBlobRef(id: string): string {
  return `${LOCAL_BLOB_PREFIX}${id}`;
}

export function localBlobId(ref: string): string {
  return ref.slice(LOCAL_BLOB_PREFIX.length);
}

export async function putBlob(blob: Blob, mimeType: string): Promise<string> {
  const db = await getLocalDb();
  const id = uuid();
  await db.put("blobs", { id, blob, mimeType, createdAt: nowIso() });
  return id;
}

/** The raw Blob itself (not a renderable object URL) — for anything
 * that needs the actual bytes, like sending an image to an AI provider
 * for on-demand categorization (see lib/ai/categorize.ts). */
export async function getBlob(id: string): Promise<Blob | null> {
  const db = await getLocalDb();
  const row = await db.get("blobs", id);
  return row?.blob ?? null;
}

export async function deleteBlob(id: string): Promise<void> {
  const db = await getLocalDb();
  await db.delete("blobs", id);
  const cached = objectUrlCache.get(id);
  if (cached) {
    URL.revokeObjectURL(cached);
    objectUrlCache.delete(id);
  }
}

// Object URLs are cheap to create but not free, and a card re-rendering
// (scroll, filter change) shouldn't mint a new one every time — kept for
// the life of the tab, not revoked until the item itself is deleted.
const objectUrlCache = new Map<string, string>();

export async function getBlobObjectUrl(id: string): Promise<string | null> {
  const cached = objectUrlCache.get(id);
  if (cached) return cached;
  const db = await getLocalDb();
  const row = await db.get("blobs", id);
  if (!row) return null;
  const url = URL.createObjectURL(row.blob);
  objectUrlCache.set(id, url);
  return url;
}

/** Pass any `src` through this before handing it to <Image>/<img>/<a
 * href>. Real http(s) URLs (bundled demo images, scraped link previews)
 * pass through untouched; a `local-blob:` reference resolves to a
 * renderable object URL, or null if the blob is somehow missing. */
export async function resolveBlobSrc(src: string): Promise<string | null> {
  if (!isLocalBlobRef(src)) return src;
  return getBlobObjectUrl(localBlobId(src));
}

/** For the few render sites that use a plain <Image>/<img> directly
 * instead of SkeletonImage (which already does this internally) — same
 * resolution, as a hook. Returns null while a `local-blob:` reference is
 * still resolving (or if the src is empty), a real src otherwise. */
export function useResolvedImageSrc(src: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(() =>
    src && !isLocalBlobRef(src) ? src : null,
  );
  // Render-time sync for the non-async cases (empty, or already a real
  // URL) — same "compare + setState during render" pattern as
  // SkeletonImage right above it, so the effect below only ever calls
  // setState from its genuinely-async .then() callback.
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setResolved(src && !isLocalBlobRef(src) ? src : null);
  }

  useEffect(() => {
    if (!src || !isLocalBlobRef(src)) return;
    let cancelled = false;
    void resolveBlobSrc(src).then((url) => {
      if (!cancelled) setResolved(url);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);
  return resolved;
}
