import type { NextConfig } from "next";
import { ports } from "@boutik/config";

const nextConfig: NextConfig = {
  transpilePackages: ["@boutik/config", "@boutik/domain", "@boutik/ui"],
  env: {
    PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN ?? "http://localhost:3000",
  },
  async rewrites() {
    if (process.env.NODE_ENV === "production") {
      return [];
    }

    return [
      { source: "/api/:path*", destination: `http://localhost:${ports.api}/api/:path*` },
      { source: "/admin", destination: `http://localhost:${ports.admin}/admin` },
      { source: "/admin/:path*", destination: `http://localhost:${ports.admin}/admin/:path*` },
      { source: "/app", destination: `http://localhost:${ports.app}/app` },
      { source: "/app/:path*", destination: `http://localhost:${ports.app}/app/:path*` },
    ];
  },
};

export default nextConfig;
