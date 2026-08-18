import type { Domain } from "../enums";

/**
 * Public runtime configuration the web reads once at startup (no auth), served
 * by `GET /api/config`. Lets a single Docker image behave differently per
 * deployment without a separate build.
 */
export interface PublicConfigDto {
  /**
   * Whether the social features (P4) are enabled on this deployment. Driven by
   * the API's `SOCIAL_ENABLED` env var (off by default); the hosted build turns
   * it on. When false, the web hides every social surface and the API rejects
   * social endpoints.
   */
  socialEnabled: boolean;

  /**
   * Whether new sign-ups are accepted on this deployment. Driven by the
   * API's `REGISTRATION_ENABLED` env var (on by default). When false, the
   * web hides the sign-up link/route and the API rejects `POST
   * /auth/register`.
   */
  registrationEnabled: boolean;

  /**
   * Domains an admin put in maintenance deployment-wide (Unleash
   * `MAINTENANCE_<DOMAIN>` flags — see FeatureFlagsService), on top of
   * whatever the signed-in user set in their own `enabledDomains`. The web
   * treats these exactly like a domain the user turned off themselves:
   * hidden from the nav, its routes redirect to `/app`. Empty when Unleash
   * isn't configured on this deployment.
   */
  maintenanceDomains: Domain[];

  /**
   * Whether the admin "Schéma" page (DB ERD + module graph) has content to
   * show. The underlying `docs/erd.md`/`docs/modules.md` are dev-only
   * artifacts, never generated in the Docker build (see `DISABLE_ERD` in
   * `apps/api/Dockerfile` and the `erd` generator in `schema.prisma`) — this
   * mirrors that by reading the API's own `NODE_ENV`.
   */
  erdEnabled: boolean;

  /** The running app's version (monorepo root package.json). */
  version: string;

  /**
   * Short (7-char) commit SHA of the running build, set at build time (see
   * `GIT_SHA` in `apps/api/Dockerfile`) — "unknown" outside a CI-built image.
   * Exposed publicly (alongside `version`) so the app can point users at the
   * exact deployed source, per AGPL §13.
   */
  gitSha: string;
}
