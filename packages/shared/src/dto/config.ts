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
}
