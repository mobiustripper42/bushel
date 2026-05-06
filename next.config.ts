import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version,
  },
  allowedDevOrigins: ["mill-dev", "mill-dev:3001", "100.118.147.49:3001"],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3001",
        "mill-dev",
        "mill-dev:3001",
        "100.118.147.49:3001",
      ],
    },
  },
};

export default nextConfig;
