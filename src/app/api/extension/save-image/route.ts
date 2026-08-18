import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { imageSize } from "image-size";
import { z } from "zod";
import { createItem } from "@/lib/items";

const bodySchema = z.object({
  imageUrl: z.string().url(),
  pageUrl: z.string().url().optional(),
  pageTitle: z.string().max(300).optional(),
});

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
  const { imageUrl, pageTitle } = parsed.data;

  let res: Response;
  try {
    res = await fetch(imageUrl);
  } catch {
    return NextResponse.json({ error: "Couldn't fetch that image" }, { status: 502 });
  }
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "Couldn't fetch that image" }, { status: 502 });
  }

  const contentType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "That URL isn't an image" }, { status: 400 });
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  let width: number | undefined;
  let height: number | undefined;
  try {
    const dims = imageSize(buffer);
    width = dims.width;
    height = dims.height;
  } catch {
    // Not every fetched image is a format image-size recognizes —
    // dimensions just stay unset, matching how a normal upload already
    // treats a bad/unreadable file (best-effort, not fatal).
  }

  const ext = contentType.split("/")[1] || "jpg";
  const pathname = `extension/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType,
  });

  const item = await createItem({
    type: "image",
    title: pageTitle,
    blobUrl: blob.url,
    blobPathname: blob.pathname,
    width,
    height,
    fileSizeBytes: buffer.byteLength,
    mimeType: contentType,
  });

  return NextResponse.json({ item }, { status: 201 });
}
