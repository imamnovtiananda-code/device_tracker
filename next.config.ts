import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SQLite file lives under ./data — keep it out of the build output.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};

export default nextConfig;
