import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createCollection, listCollectionsWithPreview } from "@/lib/collections";
import { createCollectionSchema } from "@/lib/validation";

export async function GET() {
  const collections = await listCollectionsWithPreview();
  return NextResponse.json({ collections });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const collection = await createCollection(parsed.data.name);
  return NextResponse.json({ collection }, { status: 201 });
}
