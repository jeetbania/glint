import { NextResponse } from "next/server";
import { fetchLinkMetadata } from "@/lib/link-metadata";

/** Backs the clipboard-watch "Save a URL" confirm card — a lightweight
 * read-only preview fetch (title/favicon/OG image) that runs BEFORE the
 * user commits to saving, so the notification shows what's about to be
 * saved instead of asking for a blind yes/no. Separate from POST
 * /api/items, which still does its own metadata fetch at save time (a
 * user could wait a while before clicking Save, or dismiss entirely). */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  const metadata = await fetchLinkMetadata(url);
  return NextResponse.json(metadata);
}
