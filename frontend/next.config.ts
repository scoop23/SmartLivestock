import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/:path*",
      headers: [{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }],
    }];
  },
  // Allow isolated verification without sharing the active dev server's cache.
  distDir: process.env.NEXT_OUTPUT_DIR || ".next",
};

export default nextConfig;
