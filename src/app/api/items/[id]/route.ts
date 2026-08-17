import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { deleteItem, getItem, setItemTags, updateItem } from "@/lib/items";
import { setItemCollections } from "@/lib/collections";
import { updateItemSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { tags, collections, ...fields } = parsed.data;

  if (Object.keys(fields).length > 0) {
    await updateItem(id, fields);
  }
  if (tags) {
    await setItemTags(id, tags);
  }
  if (collections) {
    await setItemCollections(id, collections);
  }

  const item = await getItem(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await deleteItem(id);
  return NextResponse.json({ ok: true });
}
