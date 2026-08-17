import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack root explicitly — the home directory (this project's
  // parent) has its own package-lock.json that Turbopack would otherwise
  // warn about while walking up looking for a workspace root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
