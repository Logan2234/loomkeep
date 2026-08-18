import { ConfigService } from "@nestjs/config";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";

/**
 * Whether the P4 social features are enabled on this deployment. Driven by
 * the runtime `SOCIAL_ENABLED` env var so a single Docker image serves both
 * modes: self-host = off (no social surface), the hosted build sets it to
 * "true". Off by default (anything other than the literal "true"). When
 * Unleash is configured (docker-compose.unleash.yml), a `SOCIAL_ENABLED` flag
 * there is authoritative — the env var only remains the fallback while that
 * flag doesn't exist yet in Unleash, or on a deployment that doesn't run it.
 *
 * Single source of truth: the web reads it via `GET /api/config`, and the
 * social endpoints (from the social module, P4 increment 1+) gate on it too.
 */
export function isSocialEnabled(
  config: ConfigService,
  flags: FeatureFlagsService,
): boolean {
  return flags.isEnabled(
    "SOCIAL_ENABLED",
    config.get<string>("SOCIAL_ENABLED") === "true",
  );
}
