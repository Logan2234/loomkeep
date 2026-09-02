// Must run before any other import: logger.config.ts reads process.env.NODE_ENV
// at module-load time (not through ConfigModule), so .env has to be loaded
// before app.module.ts (and everything it imports) even starts resolving.
import { config } from "dotenv";
config();

import "./instrument";

import helmet from "@fastify/helmet";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import * as Sentry from "@sentry/node";
import { Logger } from "nestjs-pino";
import { readFile } from "node:fs/promises";
import { join } from "path";
import { AppModule } from "./app.module";
import { ValidationException } from "./common/validation.exception";

const isDev = process.env.NODE_ENV === "development";

if (!process.env.WEB_ORIGIN) {
  throw new Error(
    "WEB_ORIGIN must be set — see .env.example (root or apps/api).",
  );
}

const webOrigin: string = process.env.WEB_ORIGIN;
const trustProxyHops = process.env.TRUST_PROXY_HOPS
  ? Number(process.env.TRUST_PROXY_HOPS)
  : false;

if (
  trustProxyHops !== false &&
  (!Number.isInteger(trustProxyHops) || trustProxyHops < 1)
) {
  throw new Error("TRUST_PROXY_HOPS must be a positive integer when set.");
}

const trustProxy =
  trustProxyHops === false
    ? false
    : (_address: string, hop: number) => hop < trustProxyHops;

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // TV Time import posts several CSV files as a JSON body; the default 1 MB
    // Fastify limit is too small for a full watch history.
    new FastifyAdapter({
      bodyLimit: 25 * 1024 * 1024,
      // Production has exactly one controlled hop (Caddy). A hop count keeps
      // Fastify from trusting an arbitrary-length forwarded chain, while the
      // production Compose override removes direct API port publication.
      trustProxy,
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
  // Lets onModuleDestroy hooks (Prisma disconnect, log flush...) run on
  // SIGTERM — otherwise a Docker redeploy kills the process before they fire.
  app.enableShutdownHooks();
  // Base docker-compose.yml (self-host, no Caddy) exposes the API directly,
  // so it can't rely solely on the edge's security headers (see Caddyfile) —
  // CSP stays off: Swagger UI (dev-only, below) needs inline scripts/styles,
  // and the API otherwise only serves JSON.
  await app.register(helmet, { contentSecurityPolicy: false });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
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
    // __dirname-relative, not cwd-relative: cwd depends on how the process
    // was launched, __dirname (apps/api/src, ts-node's own file location in
    // dev) doesn't.
    const raw = await readFile(join(__dirname, "../package.json"), "utf-8");
    const { version } = JSON.parse(raw) as { version: string };

    const { SwaggerModule, DocumentBuilder } = await import("@nestjs/swagger");
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Loomkeep API")
      .setDescription("REST API contract")
      .setVersion(version)
      .addBearerAuth()
      .build();

    SwaggerModule.setup(
      "swagger",
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  // Bind to 0.0.0.0: the Fastify adapter defaults to 127.0.0.1, which is
  // unreachable from other containers (reverse proxy) or the published port.
  await app.listen(3000, "0.0.0.0");
}

bootstrap().catch(async (err: unknown) => {
  // Sentry.init() only runs in production with a DSN set (see instrument.ts)
  // — captureException/flush are safe no-ops otherwise.
  Sentry.captureException(err);
  await Sentry.flush(2000);
  console.error(err);
  process.exit(1);
});
