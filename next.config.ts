import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingRoot: process.cwd(),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.letterboxd.com",
      },
      {
        protocol: "https",
        hostname: "**.ltrbxd.com",
      },
      {
        protocol: "https",
        hostname: "a.ltrbxd.com",
      },
    ],
  },
};

export default nextConfig;
