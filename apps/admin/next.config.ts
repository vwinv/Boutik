import type { NextConfig } from "next";
import { ports } from "@boutik/config";

const nextConfig: NextConfig = {
  basePath: "/admin",
  transpilePackages: ["@boutik/config", "@boutik/domain", "@boutik/sdk", "@boutik/ui"],
  env: {
    PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN ?? "http://localhost:3000",
  },
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    // basePath:false — le client fetch("/api/…") hors du préfixe /admin.
    return [
      {
        source: "/api/:path*",
        destination: `http://localhost:${ports.api}/api/:path*`,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
