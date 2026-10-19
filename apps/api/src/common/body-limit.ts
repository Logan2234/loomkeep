import type { FastifyInstance } from "fastify";

/**
 * Every route parses at most this much JSON — Fastify's own default. The
 * adapter-wide limit used to be 25 MB for the sake of imports, which let any
 * anonymous request (login, CSP reports…) make the single API process parse
 * 25 MB before a guard, the throttler included, could turn it away.
 */
export const DEFAULT_BODY_LIMIT = 1024 * 1024;

const LARGE_BODY_LIMIT = 25 * 1024 * 1024;

/**
 * The few routes that legitimately carry more, by Fastify route pattern
 * (global prefix included). All of them are behind a session.
 */
export const BODY_LIMITS: Readonly<Record<string, number>> = {
  // A full TV Time export or Trakt ZIP, base64 (see AnalyzeImportDto).
  "/api/import/:source/analyze": LARGE_BODY_LIMIT,
  // The per-item decisions for that same import.
  "/api/import/:source/:jobId/commit": LARGE_BODY_LIMIT,
  // An admin restoring a dump.
  "/api/admin/backup/restore": LARGE_BODY_LIMIT,
  // A 3 MB base64 avatar (see UploadAvatarDto) plus its JSON envelope.
  "/api/users/me/avatar": 4 * 1024 * 1024,
};

/** Raises the body limit on the routes of {@link BODY_LIMITS} as they register. */
export function registerBodyLimits(app: FastifyInstance): void {
  app.addHook("onRoute", (route) => {
    const limit = BODY_LIMITS[route.url];

    if (limit !== undefined && route.bodyLimit === undefined) {
      route.bodyLimit = limit;
    }
  });
}
