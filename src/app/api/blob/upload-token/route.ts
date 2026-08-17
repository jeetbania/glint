import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

// Issues short-lived tokens for direct-to-Blob browser uploads so pasted
// images never round-trip through a Function body. This route sits behind
// the proxy auth gate like everything else in the app.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "image/png",
          "image/jpeg",
          "image/gif",
          "image/webp",
          "image/svg+xml",
          "image/avif",
        ],
        addRandomSuffix: true,
        maximumSizeInBytes: 25 * 1024 * 1024, // 25MB, generous for pasted screenshots
      }),
      onUploadCompleted: async () => {
        // No-op: the client creates the corresponding `items` row itself
        // via POST /api/items once `upload()` resolves. This webhook also
        // never fires against a localhost dev server anyway.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
