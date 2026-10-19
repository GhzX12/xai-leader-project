import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in its own folder; pin the root so Next.js does not pick up
  // a lockfile from a parent directory.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
