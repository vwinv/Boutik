import type { NextConfig } from "next";
import { ports } from "@boutik/config";

const nextConfig: NextConfig = {
  basePath: "/app",
  transpilePackages: ["@boutik/config", "@boutik/domain", "@boutik/sdk", "@boutik/ui"],
  env: {
    PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN ?? "http://localhost:3000",
    NEXT_PUBLIC_WHATSAPP_EMBEDDED_ORIGIN: process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_ORIGIN ?? "",
  },
  async rewrites() {
    if (process.env.NODE_ENV === "production") {
      const api = process.env.API_URL?.replace(/\/$/, "");
      if (!api) return [];
      // fetch("/api/…") ignore basePath → rewrite hors /app
      return [
        {
          source: "/api/:path*",
          destination: `${api}/api/:path*`,
          basePath: false,
        },
      ];
    }
    return [{ source: "/api/:path*", destination: `http://localhost:${ports.api}/api/:path*` }];
  },
};

export default nextConfig;
