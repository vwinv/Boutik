import type { NextConfig } from "next";
import { ports } from "@boutik/config";

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

const nextConfig: NextConfig = {
  transpilePackages: ["@boutik/config", "@boutik/domain", "@boutik/ui"],
  env: {
    PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN ?? "http://localhost:3000",
  },
  async rewrites() {
    if (process.env.NODE_ENV === "production") {
      const api = process.env.API_URL ? stripTrailingSlash(process.env.API_URL) : "";
      const app = process.env.APP_ORIGIN ? stripTrailingSlash(process.env.APP_ORIGIN) : "";
      const admin = process.env.ADMIN_ORIGIN ? stripTrailingSlash(process.env.ADMIN_ORIGIN) : "";
      const rules: { source: string; destination: string }[] = [];
      if (api) {
        rules.push({ source: "/api/:path*", destination: `${api}/api/:path*` });
      }
      if (admin) {
        rules.push(
          { source: "/admin", destination: `${admin}/admin` },
          { source: "/admin/:path*", destination: `${admin}/admin/:path*` },
        );
      }
      if (app) {
        rules.push(
          { source: "/app", destination: `${app}/app` },
          { source: "/app/:path*", destination: `${app}/app/:path*` },
        );
      }
      return rules;
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
