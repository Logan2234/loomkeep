import { ConfigService } from "@nestjs/config";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";

/**
 * Whether new sign-ups are accepted on this deployment. Driven by the runtime
 * `REGISTRATION_ENABLED` env var so a self-host admin can close registration
 * once their account (and any family accounts) exist, without touching auth
 * itself. On by default (anything other than the literal "false"). When
 * Unleash is configured (docker-compose.unleash.yml), a `REGISTRATION_ENABLED`
 * flag there is authoritative — the env var only remains the fallback while
 * that flag doesn't exist yet in Unleash, or on a deployment that doesn't run
 * it.
 *
 * Single source of truth: the web reads it via `GET /api/config` to hide the
 * sign-up link/route, and `AuthService.register()` rejects the call too.
 */
export function isRegistrationEnabled(
  config: ConfigService,
  flags: FeatureFlagsService,
): boolean {
  return flags.isEnabled(
    "REGISTRATION_ENABLED",
    config.get<string>("REGISTRATION_ENABLED") !== "false",
  );
}
