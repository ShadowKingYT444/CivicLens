import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  logging: {
    incomingRequests: { ignore: [/^\/api\/search(?:\?|$)/] },
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
