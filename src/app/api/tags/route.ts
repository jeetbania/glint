import { NextResponse } from "next/server";
import { listTagsWithCounts } from "@/lib/items";

export async function GET() {
  const tags = (await listTagsWithCounts()).filter((t) => t.count > 0);
  return NextResponse.json({ tags });
}
