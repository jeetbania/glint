import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  deleteCollection,
  getCollectionBySlug,
  getItemPositionsForCollection,
  renameCollection,
} from "@/lib/collections";
import { listItems } from "@/lib/items";
import { renameCollectionSchema } from "@/lib/validation";

type Params = { params: Promise<{ slug: string }> };

/** Canvas bootstrap payload: the collection itself, its member items
 * (visuals + notes + tasks — the canvas isn't visuals-only like the
 * Library grid), and any saved x/y/w/h/z placements for them. */
export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [items, positions] = await Promise.all([
    listItems({ collectionSlug: slug, sort: "recent-desc" }),
    getItemPositionsForCollection(collection.id),
  ]);

  return NextResponse.json({ collection, items, positions });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const existing = await getCollectionBySlug(slug);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = renameCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const collection = await renameCollection(existing.id, parsed.data.name);
  return NextResponse.json({ collection });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const existing = await getCollectionBySlug(slug);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await deleteCollection(existing.id);
  return NextResponse.json({ ok: true });
}
