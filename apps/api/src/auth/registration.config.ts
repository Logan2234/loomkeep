import { ConfigService } from "@nestjs/config";

/**
 * Whether new sign-ups are accepted on this deployment. Driven by the runtime
 * `REGISTRATION_ENABLED` env var so a self-host admin can close registration
 * once their account (and any family accounts) exist, without touching auth
 * itself. On by default (anything other than the literal "false").
 *
 * Single source of truth: the web reads it via `GET /api/config` to hide the
 * sign-up link/route, and `AuthService.register()` rejects the call too.
 */
export function isRegistrationEnabled(config: ConfigService): boolean {
  return config.get<string>("REGISTRATION_ENABLED") !== "false";
}
