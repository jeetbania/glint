import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

// The desktop app's built-in updater polls this endpoint. It's a static
// passthrough to whatever `scripts/release-desktop.ts` most recently
// uploaded to Blob under `desktop-updates/latest.json` — this route just
// finds that blob and returns its contents, so shipping a new desktop
// build never requires a code change or redeploy of the web app itself.
export async function GET(): Promise<NextResponse> {
  const { blobs } = await list({ prefix: "desktop-updates/latest.json" });
  const manifestBlob = blobs[0];

  if (!manifestBlob) {
    // No desktop build has ever been released — Tauri's updater treats a
    // 204 as "no update available" rather than an error.
    return new NextResponse(null, { status: 204 });
  }

  const manifest = await fetch(manifestBlob.url, { cache: "no-store" }).then(
    (r) => r.json(),
  );
  return NextResponse.json(manifest, {
    headers: { "Cache-Control": "no-store" },
  });
}
