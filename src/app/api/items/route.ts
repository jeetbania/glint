import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { after } from "next/server";
import { createItem, listItems, updateItem } from "@/lib/items";
import { fetchLinkMetadata } from "@/lib/link-metadata";
import { createItemSchema, listItemsQuerySchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = listItemsQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { type, tag, color, q, limit, offset } = parsed.data;
  const results = await listItems({
    type,
    tagSlug: tag,
    color,
    q,
    limit,
    offset,
  });
  return NextResponse.json({ items: results });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (input.type === "image") {
    const item = await createItem({
      type: "image",
      title: input.title,
      blobUrl: input.blobUrl,
      blobPathname: input.blobPathname,
      width: input.width,
      height: input.height,
      fileSizeBytes: input.fileSizeBytes,
      mimeType: input.mimeType,
      dominantColors: input.dominantColors,
      colorFamily: input.colorFamily,
    });
    return NextResponse.json({ item }, { status: 201 });
  }

  if (input.type === "link") {
    const item = await createItem({
      type: "link",
      url: input.url,
      title: input.title ?? null,
    });

    // Respond immediately with the bare-URL card; enrich it with OG
    // metadata after the response is sent so paste-to-card feels instant.
    after(async () => {
      const meta = await fetchLinkMetadata(input.url);
      await updateItem(item.id, {
        title: item.title ?? meta.title,
        domain: meta.domain,
        faviconUrl: meta.faviconUrl,
        previewImageUrl: meta.previewImageUrl,
        bodyText: meta.description,
      });
    });

    return NextResponse.json({ item }, { status: 201 });
  }

  if (input.type === "note") {
    const item = await createItem({
      type: "note",
      title: input.title,
      bodyText: input.bodyText,
      bodyJson: input.bodyJson,
    });
    return NextResponse.json({ item }, { status: 201 });
  }

  // task
  const item = await createItem({
    type: "task",
    title: input.title,
    bodyText: input.bodyText,
  });
  return NextResponse.json({ item }, { status: 201 });
}
