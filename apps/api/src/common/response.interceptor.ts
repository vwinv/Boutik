import {
  StreamableFile,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { map, type Observable } from "rxjs";
import type { ApiSuccess } from "@boutik/domain";

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T> | StreamableFile> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T> | StreamableFile> {
    const http = context.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const requestIdHeader = request.headers["x-request-id"];
    const requestId = typeof requestIdHeader === "string" && requestIdHeader.length > 0 ? requestIdHeader : randomUUID();

    response.setHeader("x-request-id", requestId);

    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) {
          return data;
        }

        if (isAlreadyEnvelope(data)) {
          return data as ApiSuccess<T>;
        }

        return { ok: true, data };
      }),
    );
  }
}

function isAlreadyEnvelope(data: unknown): data is ApiSuccess<unknown> {
  return data !== null && typeof data === "object" && "ok" in data && "data" in data;
}
