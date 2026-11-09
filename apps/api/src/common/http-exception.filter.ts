import { type ArgumentsHost, Catch, type ExceptionFilter, Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { PinoLogger } from "nestjs-pino";
import type { ApiFailure } from "@boutik/domain";
import { mapException } from "./map-exception";

@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(HttpExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = requestIdOf(request);
    const mapped = mapException(exception);

    const payload = {
      requestId,
      method: request.method,
      url: request.originalUrl ?? request.url,
      status: mapped.status,
      code: mapped.code,
    };

    if (mapped.exposeStack) {
      this.logger.error(
        {
          ...payload,
          err: exception instanceof Error ? exception : undefined,
        },
        "Unhandled exception",
      );
    } else if (mapped.status === 404) {
      this.logger.debug(payload, "Resource not found");
    } else {
      this.logger.warn(payload, "Request rejected");
    }

    const body: ApiFailure = {
      ok: false,
      error: {
        code: mapped.code,
        message: mapped.message,
        ...(mapped.details === undefined ? {} : { details: mapped.details }),
      },
    };

    if (requestId) {
      response.setHeader("x-request-id", requestId);
    }

    response.status(mapped.status).json(body);
  }
}

function requestIdOf(request: Request) {
  const fromPino = "id" in request ? String(request.id) : undefined;
  const header = request.headers["x-request-id"];
  const fromHeader = typeof header === "string" && header.length > 0 ? header : undefined;
  return fromPino ?? fromHeader;
}
