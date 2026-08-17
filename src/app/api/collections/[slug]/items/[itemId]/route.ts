import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCollectionBySlug, setItemPositionInCollection } from "@/lib/collections";
import { setItemPositionSchema } from "@/lib/validation";

type Params = { params: Promise<{ slug: string; itemId: string }> };

/** Debounce-persisted from the canvas on drag/resize end — see
 * CollectionCanvas. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug, itemId } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = setItemPositionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  await setItemPositionInCollection(collection.id, itemId, parsed.data);
  return NextResponse.json({ ok: true });
}
