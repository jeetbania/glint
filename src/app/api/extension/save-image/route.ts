import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { imageSize } from "image-size";
import sharp from "sharp";
import { z } from "zod";
import { createItem } from "@/lib/items";

const bodySchema = z.object({
  imageUrl: z.string().url(),
  pageUrl: z.string().url().optional(),
  pageTitle: z.string().max(300).optional(),
});

// These are quick inspiration grabs, not archival-quality saves — capping
// the long edge and re-encoding to WebP keeps blob storage/bandwidth (and
// how long the item takes to load back in the app) way down without a
// visible quality hit at the sizes they're actually viewed at.
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 82;

/** Save-image entry point for the browser extension's right-click "Save
 * image to Glint" — the extension only ever hands over a raw image URL
 * (no blob client SDK bundled there), so the actual download-and-upload
 * happens server-side here instead of the usual client-upload-token
 * dance the web app uses for local file picks. No dominant-color
 * extraction (that's a browser-canvas/worker step client-side today) —
 * an acceptable gap for a quick-capture path; these items just won't
 * show up in color-family filtering. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { imageUrl, pageUrl, pageTitle } = parsed.data;

  let res: Response;
  try {
    // Plenty of image CDNs (X/Twitter's included) reject requests with
    // no browser-like User-Agent or a missing/mismatched Referer as
    // basic anti-hotlinking — a server-to-server fetch with neither
    // reads exactly like a scraper. Sending both, with Referer set to
    // the page the image was captured from, gets past that for the
    // common case.
    res = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        ...(pageUrl ? { Referer: pageUrl } : {}),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Couldn't fetch that image: ${err instanceof Error ? err.message : "network error"}` },
      { status: 502 },
    );
  }
  if (!res.ok || !res.body) {
    return NextResponse.json(
      { error: `Couldn't fetch that image (upstream returned ${res.status})` },
      { status: 502 },
    );
  }

  const sourceContentType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  if (!sourceContentType.startsWith("image/")) {
    return NextResponse.json({ error: "That URL isn't an image" }, { status: 400 });
  }
  const sourceBuffer = Buffer.from(await res.arrayBuffer());

  // Animated GIFs keep their original bytes — re-encoding through sharp
  // without {animated: true} would flatten them to a single static
  // frame, which is a worse trade than just leaving the file bigger.
  // Everything else gets downsized + recompressed to WebP.
  let outBuffer = sourceBuffer;
  let outContentType = sourceContentType;
  let width: number | undefined;
  let height: number | undefined;

  if (sourceContentType !== "image/gif") {
    try {
      const { data, info } = await sharp(sourceBuffer)
        .rotate() // bake in EXIF orientation before the dimensions below are read from it
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      outBuffer = data;
      outContentType = "image/webp";
      width = info.width;
      height = info.height;
    } catch {
      // Unrecognized/corrupt source format — fall back to storing the
      // original bytes untouched rather than failing the whole save.
      outBuffer = sourceBuffer;
      outContentType = sourceContentType;
    }
  }

  if (width === undefined || height === undefined) {
    try {
      const dims = imageSize(outBuffer);
      width = dims.width;
      height = dims.height;
    } catch {
      // Not every fallback buffer is a format image-size recognizes
      // either — dimensions just stay unset (best-effort, not fatal).
    }
  }

  const ext = outContentType.split("/")[1] || "jpg";
  const pathname = `extension/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const blob = await put(pathname, outBuffer, {
    access: "public",
    contentType: outContentType,
  });

  const item = await createItem({
    type: "image",
    title: pageTitle,
    blobUrl: blob.url,
    blobPathname: blob.pathname,
    width,
    height,
    fileSizeBytes: outBuffer.byteLength,
    mimeType: outContentType,
  });

  return NextResponse.json({ item }, { status: 201 });
}
