// Must run before any other import: logger.config.ts reads process.env.NODE_ENV
// at module-load time (not through ConfigModule), so .env has to be loaded
// before app.module.ts (and everything it imports) even starts resolving.
import { config } from "dotenv";
config();

import "./instrument";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { ValidationException } from "./common/validation.exception";

const isDev = process.env.NODE_ENV === "development";

if (!process.env.WEB_ORIGIN) {
  throw new Error(
    "WEB_ORIGIN must be set — see .env.example (root or apps/api).",
  );
}

const webOrigin: string = process.env.WEB_ORIGIN;

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    // TV Time import posts several CSV files as a JSON body; the default 1 MB
    // Fastify limit is too small for a full watch history.
    new FastifyAdapter({
      bodyLimit: 25 * 1024 * 1024,
      // Off by default: trusting X-Forwarded-For is only safe when every
      // request truly passes through a controlled proxy first. Self-host
      // (base docker-compose.yml, no Caddy) exposes the API directly, so a
      // client could set X-Forwarded-For itself and spoof its IP for
      // rate-limiting/@Ip() purposes — hence opt-in via TRUST_PROXY, set to
      // "true" only in docker-compose.prod.yml (Caddy always sits in front
      // there). See docker/README.md "Cloudflare" for the residual risk of
      // the API's port still being reachable directly, bypassing Caddy.
      trustProxy: process.env.TRUST_PROXY === "true",
    }),
    {
      // Nest's built-in console logger is replaced by nestjs-pino below
      // (structured JSON, see common/logger.config.ts) — bufferLogs holds
      // every log emitted before app.useLogger() attaches it.
      httpsOptions:
        process.env.API_TLS_KEY && process.env.API_TLS_CERT
          ? {
              key: process.env.API_TLS_KEY,
              cert: process.env.API_TLS_CERT,
            }
          : undefined,
      abortOnError: true,
      autoFlushLogs: true,
      bufferLogs: true,
      moduleIdGeneratorAlgorithm: "reference",
      forceConsole: false,
      preview: false,
      // Needed so QuackbackWebhookGuard can verify the HMAC signature over
      // the exact bytes Quackback sent (populates request.rawBody).
      rawBody: true,
      snapshot: false,
      cors: {
        // Comma-separated so multiple origins can be allowed at once.
        origin: webOrigin.split(",").map((o) => o.trim()),
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        optionsSuccessStatus: 204,
        maxAge: 3600,
        credentials: true,
        exposedHeaders: ["Content-Disposition"],
        preflightContinue: false,
      },
    },
  );

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    // ValidationException (exceptionFactory below) reads each error's
    // `.target` — the validated DTO instance — to look up the raw
    // constraint arguments in class-validator's metadata storage. That
    // relies on class-validator's own default (`validationError.target`
    // defaults to `true`), which we don't override here: setting
    // `validationError: { target: false }` would silently break the
    // per-field param extraction.
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => new ValidationException(errors),
    }),
  );

  // Swagger UI on /docs, dev-only. @nestjs/swagger is a production dependency
  // regardless (the nest-cli swagger plugin injects it into every compiled
  // file using @Api* decorators), but the UI itself is still gated to dev.
  if (isDev) {
    const { SwaggerModule, DocumentBuilder } = await import("@nestjs/swagger");
    const config = new DocumentBuilder()
      .setTitle("Loomkeep API")
      .setDescription("REST API contract")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();

    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));
  }

  // Bind to 0.0.0.0: the Fastify adapter defaults to 127.0.0.1, which is
  // unreachable from other containers (reverse proxy) or the published port.
  await app.listen(3000, "0.0.0.0");
}

void bootstrap();
