import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import { isAllowedOrigin } from "@boutik/config";

const ALLOWED_HEADERS = ["Accept", "Authorization", "Content-Type", "X-Request-Id"];
const EXPOSED_HEADERS = ["X-Request-Id"];
const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

export function createCorsOptions(): CorsOptions {
  return {
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    exposedHeaders: EXPOSED_HEADERS,
    maxAge: 86_400,
    optionsSuccessStatus: 204,
  };
}
