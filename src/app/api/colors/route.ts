import { NextResponse } from "next/server";
import { listColorFamilyCounts } from "@/lib/items";

export async function GET() {
  const colors = await listColorFamilyCounts();
  return NextResponse.json({ colors });
}
