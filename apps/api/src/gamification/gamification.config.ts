import { ConfigService } from "@nestjs/config";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";

/**
 * Whether the gamification system (XP ledger, levels, achievements — G1+) is
 * enabled on this deployment. Exact copy of `isSocialEnabled`'s pattern:
 * Unleash is authoritative once a `GAMIFICATION_ENABLED` flag exists there,
 * the runtime env var is the fallback (off unless literally "true") — a
 * single Docker image serves both self-host (off) and the hosted build,
 * which sets the env var to enable it. See `PublicConfigDto.gamificationEnabled`.
 */
export function isGamificationEnabled(
  config: ConfigService,
  flags: FeatureFlagsService,
): boolean {
  return flags.isEnabled(
    "GAMIFICATION_ENABLED",
    config.get<string>("GAMIFICATION_ENABLED") === "true",
  );
}
