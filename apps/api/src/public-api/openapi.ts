import type { INestApplication } from "@nestjs/common";
import type { OpenAPIObject } from "@nestjs/swagger";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { PublicApiModule } from "./public-api.module";

export const PUBLIC_API_DOCUMENT_PATH = "/api/v1/openapi.json";

/**
 * The public API's contract alone: only PublicApiModule's controllers, so
 * internal routes never show up in what third parties read. Each instance
 * serves its own, matching the version it runs.
 */
export function buildPublicApiDocument(
  app: INestApplication,
  version: string,
  /** Where requests go; none means the instance serving the document. */
  server?: { url: string; description: string },
): OpenAPIObject {
  const builder = new DocumentBuilder();
  if (server) builder.addServer(server.url, server.description);
  return SwaggerModule.createDocument(
    app,
    builder
      .setTitle("Loomkeep API")
      .setDescription(
        "Read access to a Loomkeep account with a personal API key (Settings › Integrations), sent as `Authorization: Bearer lk_…`.",
      )
      .setVersion(version)
      .addBearerAuth({
        type: "http",
        scheme: "bearer",
        bearerFormat: "lk_…",
        description: "A personal API key, from Settings › Integrations.",
      })
      .build(),
    { include: [PublicApiModule] },
  );
}
