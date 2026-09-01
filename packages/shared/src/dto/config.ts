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
   * Whether the gamification system (XP, levels, achievements — G1+) is
   * enabled on this deployment. Driven by the API's `GAMIFICATION_ENABLED`
   * env var, on by default on the hosted build. When false, `XpService.award`
   * is a no-op and the web hides every gamification surface.
   */
  gamificationEnabled: boolean;

  /**
   * Whether new sign-ups are accepted on this deployment. Driven by the
   * API's `REGISTRATION_ENABLED` env var (on by default). When false, the
   * web hides the sign-up link/route and the API rejects `POST
   * /auth/register`.
   */
  registrationEnabled: boolean;

  /**
   * Whether the admin "Schéma" page (DB ERD + module graph) has content to
   * show. The underlying `docs/erd.md`/`docs/modules.md` are dev-only
   * artifacts, never generated in the Docker build (see `DISABLE_ERD` in
   * `apps/api/Dockerfile` and the `erd` generator in `schema.prisma`) — this
   * mirrors that by reading the API's own `NODE_ENV`.
   */
  erdEnabled: boolean;

  /**
   * Whether admin accounts are actually blocked from /admin when they have
   * no MFA method active (LK-C17) — true only when the API's `NODE_ENV` is
   * `production`. Off outside production so local/staging dev doesn't
   * require setting up TOTP/email MFA (and doesn't burn the transactional
   * email quota) just to reach the admin panel; the underlying MFA feature
   * itself stays fully available in every environment.
   */
  adminMfaEnforced: boolean;

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
