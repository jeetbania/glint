import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCollectionBySlug } from "@/lib/collections";
import { createCanvasObject, listCanvasObjects } from "@/lib/canvas-objects";
import { createCanvasObjectSchema } from "@/lib/validation";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canvasObjects = await listCanvasObjects(collection.id);
  return NextResponse.json({ canvasObjects });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = createCanvasObjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const canvasObject = await createCanvasObject(collection.id, parsed.data);
  return NextResponse.json({ canvasObject }, { status: 201 });
}
