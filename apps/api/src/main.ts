import { Logger } from "nestjs-pino";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { assertRequiredEnv, getApiPort, getNodeEnv } from "@boutik/config";
import { AppModule } from "./app.module";
import { createCorsOptions } from "./common/cors";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);
  // Photos in onboarding content are sent as data URLs in JSON.
  app.useBodyParser("json", { limit: "8mb" });
  app.useBodyParser("urlencoded", { limit: "8mb", extended: true });
  app.enableShutdownHooks();
  app.setGlobalPrefix("api");
  assertRequiredEnv();
  app.enableCors(createCorsOptions());

  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error(`Unhandled promise rejection: ${error.message}`, error.stack);
  });

  process.on("uncaughtException", (error) => {
    logger.error(`Uncaught exception: ${error.message}`, error.stack);
    process.exit(1);
  });

  const port = getApiPort();
  await app.listen(port);
  logger.log(`API Boutik prête sur http://localhost:${port}/api (${getNodeEnv()})`);
}

void bootstrap();
