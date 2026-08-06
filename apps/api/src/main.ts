import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

const isDev = process.env.NODE_ENV === "development";

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    // TV Time import posts several CSV files as a JSON body; the default 1 MB
    // Fastify limit is too small for a full watch history.
    new FastifyAdapter({ bodyLimit: 25 * 1024 * 1024 }),
    {
      logger: ["error", "warn", "log", "fatal", "debug", "verbose"],
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
      rawBody: false,
      snapshot: false,
      cors: {
        // Comma-separated so a dev box can allow both localhost and an ngrok
        // tunnel domain at once (see README "Mobile access").
        origin: (process.env.WEB_ORIGIN ?? "http://localhost:5173")
          .split(",")
          .map((o) => o.trim()),
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

  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger UI on /docs, dev-only. Dynamically imported so @nestjs/swagger
  // stays a devDependency and is never loaded in production.
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
