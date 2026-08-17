import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { deleteCollection, renameCollection } from "@/lib/collections";
import { renameCollectionSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = renameCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const collection = await renameCollection(id, parsed.data.name);
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ collection });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await deleteCollection(id);
  return NextResponse.json({ ok: true });
}
