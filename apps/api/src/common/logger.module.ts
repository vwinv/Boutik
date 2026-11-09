import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { LoggerModule } from "nestjs-pino";
import { getLogLevel } from "@boutik/config";

function pinoHttpOptions() {
  return {
    level: getLogLevel(),
    genReqId: (req: IncomingMessage, res: ServerResponse) => {
      const existing = req.headers["x-request-id"];
      const id = typeof existing === "string" && existing.length > 0 ? existing : randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },
    customProps: (req: IncomingMessage) => ({
      requestId: "id" in req ? req.id : undefined,
    }),
    serializers: {
      req: (req: IncomingMessage & { id?: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res: { statusCode?: number }) => ({
        statusCode: res.statusCode,
      }),
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        'req.headers["set-cookie"]',
        "*.password",
        "*.passwordHash",
      ],
      censor: "[Redacted]",
    },
    autoLogging: {
      ignore: (req: IncomingMessage) => {
        const url = req.url ?? "";
        return url === "/api/health" || url.startsWith("/api/health?");
      },
    },
  };
}

export const loggerModule = LoggerModule.forRootAsync({
  useFactory: () => ({
    pinoHttp: pinoHttpOptions(),
  }),
});
