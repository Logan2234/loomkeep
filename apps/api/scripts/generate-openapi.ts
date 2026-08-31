// Boots the compiled app (no HTTP listener) to build the OpenAPI document
// and writes it to a file — so the web side can regenerate its typed
// client (`pnpm --filter web generate:api-types`).
//
// Requires `pnpm --filter @loomkeep/api build` to have run first: the
// swagger decorators/response shapes only come out correct when compiled
// through the Nest CLI's own build pipeline (`nest build`), which is what
// applies the @nestjs/swagger compiler plugin. Running the .ts source
// through plain ts-node skips that plugin entirely and silently produces
// empty schemas for every response DTO — this script boots the already-
// compiled dist/ output instead, so ts-node never touches the plugin-
// dependent files at all.
import { config } from "dotenv";
config();

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DIST_APP_MODULE = join(__dirname, "../dist/src/app.module.js");

async function main() {
  if (!existsSync(DIST_APP_MODULE)) {
    console.error(
      "dist/src/app.module.js not found — run `pnpm --filter @loomkeep/api build` first.",
    );
    process.exit(1);
  }

  const { AppModule } = await import(pathToFileURL(DIST_APP_MODULE).href);

  const app = await NestFactory.create(AppModule, new FastifyAdapter(), {
    logger: false,
  });
  app.setGlobalPrefix("api");

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Loomkeep API")
      .setDescription("REST API contract")
      .setVersion("0.0.0")
      .addBearerAuth()
      .build(),
  );

  writeFileSync(
    join(__dirname, "../openapi.json"),
    JSON.stringify(document, null, 2) + "\n",
  );

  await app.close();
  process.exit(0);
}

void main();
