import type { NextConfig } from "next";
import { ports } from "@boutik/config";

const nextConfig: NextConfig = {
  transpilePackages: ["@boutik/config", "@boutik/domain", "@boutik/sdk", "@boutik/ui"],
  env: {
    PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN ?? "http://localhost:3000",
  },
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    return [{ source: "/api/:path*", destination: `http://localhost:${ports.api}/api/:path*` }];
  },
};

export default nextConfig;
