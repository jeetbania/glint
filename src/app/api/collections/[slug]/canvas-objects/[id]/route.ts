import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCollectionBySlug } from "@/lib/collections";
import { deleteCanvasObject, updateCanvasObject } from "@/lib/canvas-objects";
import { updateCanvasObjectSchema } from "@/lib/validation";

type Params = { params: Promise<{ slug: string; id: string }> };

/** Debounce-persisted from the canvas on move/resize/edit — see
 * CollectionCanvas, mirrors items/[itemId]'s PATCH. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug, id } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = updateCanvasObjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const canvasObject = await updateCanvasObject(id, collection.id, parsed.data);
  if (!canvasObject) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ canvasObject });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { slug, id } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await deleteCanvasObject(id, collection.id);
  return NextResponse.json({ ok: true });
}
