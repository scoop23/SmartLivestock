import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow isolated verification without sharing the active dev server's cache.
  distDir: process.env.NEXT_OUTPUT_DIR || ".next",
};

export default nextConfig;
