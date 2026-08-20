import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack root explicitly — the home directory (this project's
  // parent) has its own package-lock.json that Turbopack would otherwise
  // warn about while walking up looking for a workspace root.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Lets next/image actually optimize (resize + recompress to WebP/AVIF)
  // the real saved-item photos the landing page's hero mockup embeds —
  // those originals run 1-1.3MB each at ~3700px wide, which is what was
  // making the hero slow to load when rendered `unoptimized` at
  // thumbnail size. The rest of the app deliberately keeps `unoptimized`
  // on its own Image usages (per-user dynamic blob URLs, not worth
  // pre-declaring every possible store), so this only widens what CAN
  // be optimized — it doesn't change how any existing page renders.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
