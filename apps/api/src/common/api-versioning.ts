import type { INestApplication } from "@nestjs/common";
import { VERSION_NEUTRAL, VersioningType } from "@nestjs/common";

/**
 * Only the public API is versioned (`/api/v1/...`, via `version` on its
 * controllers). Internal routes stay version-neutral: their one client, the
 * web app, ships in the same release, so a breaking change there is atomic.
 */
export function enableApiVersioning(app: INestApplication): void {
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: VERSION_NEUTRAL,
  });
}
