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
import { enableApiVersioning } from "../src/common/api-versioning";

const DIST_APP_MODULE = join(__dirname, "../dist/src/app.module.js");
const DIST_PUBLIC_API_DOCUMENT = join(
  __dirname,
  "../dist/src/public-api/openapi.js",
);
const DIST_OPENAPI_COMPLETENESS = join(
  __dirname,
  "../dist/src/public-api/openapi-completeness.js",
);

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
  enableApiVersioning(app);

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

  // The public API's own contract, for the docs site (apps/docs): v1 routes
  // only, its "Try it" console pointed at the hosted instance by default. It
  // is published, so a gap in it fails the build (see undocumentedParts).
  const { buildPublicApiDocument } = await import(
    pathToFileURL(DIST_PUBLIC_API_DOCUMENT).href
  );
  const { undocumentedParts } = await import(
    pathToFileURL(DIST_OPENAPI_COMPLETENESS).href
  );
  const publicDocument = buildPublicApiDocument(app, "1", {
    defaultHost: "loomkeep.app",
  });
  writeFileSync(
    join(__dirname, "../openapi-v1.json"),
    JSON.stringify(publicDocument, null, 2) + "\n",
  );

  const gaps: string[] = undocumentedParts(publicDocument);

  if (gaps.length > 0) {
    console.error(
      `The public API reference has ${gaps.length} undocumented part(s) — add JSDoc to the DTO or a description to the decorator:\n  ${gaps.join("\n  ")}`,
    );
    await app.close();
    process.exit(1);
  }

  await app.close();
  process.exit(0);
}

void main();
