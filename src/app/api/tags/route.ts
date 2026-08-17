import { NextResponse } from "next/server";
import { listTagsWithCounts } from "@/lib/items";

export async function GET() {
  const tags = await listTagsWithCounts();
  return NextResponse.json({ tags });
}
