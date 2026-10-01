import type { ApiKeyQuotaDto } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { EntitlementService } from "../entitlements/entitlement.service";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { InstanceSettingsService } from "../instance-settings/instance-settings.service";

const WINDOW_MS = 60_000;
// How long a resolved plan is trusted: an upgrade takes effect within a minute.
const PLAN_TTL_MS = 60_000;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets. */
  resetIn: number;
}

/**
 * Per-account request budget on the public API, in a fixed one-minute
 * window. Per account rather than per key, or minting ten keys would buy ten
 * times the quota. In memory: the API runs as a single process.
 */
@Injectable()
export class ApiRateLimitService {
  private readonly windows = new Map<
    string,
    { start: number; count: number }
  >();

  private readonly plans = new Map<string, { limit: number; until: number }>();

  constructor(
    private readonly entitlements: EntitlementService,
    private readonly flags: FeatureFlagsService,
    private readonly settings: InstanceSettingsService,
  ) {}

  async consume(userId: string): Promise<RateLimitResult> {
    const limit = await this.limitFor(userId);
    const now = Date.now();
    let window = this.windows.get(userId);

    if (!window || now - window.start >= WINDOW_MS) {
      window = { start: now, count: 0 };
      this.windows.set(userId, window);
    }

    const allowed = window.count < limit;
    if (allowed) window.count++;
    return {
      allowed,
      limit,
      remaining: limit - window.count,
      resetIn: Math.ceil((window.start + WINDOW_MS - now) / 1000),
    };
  }

  async quota(userId: string): Promise<ApiKeyQuotaDto> {
    const perMinute = await this.limitFor(userId);
    const premiumLimit = this.settings.get("apiRateLimitPremium");
    const upgradable = this.premiumOffered() && perMinute < premiumLimit;
    return {
      perMinute,
      premiumPerMinute: upgradable ? premiumLimit : null,
    };
  }

  async limitFor(userId: string): Promise<number> {
    const cached = this.plans.get(userId);
    if (cached && cached.until > Date.now()) return cached.limit;

    // Unlike isEffectivelyPremium, an unreleased premium doesn't lift the
    // quota for everyone: the free limit is the instance's default.
    const premium =
      this.premiumOffered() && (await this.entitlements.hasPremium(userId));
    const limit = this.settings.get(
      premium ? "apiRateLimitPremium" : "apiRateLimitFree",
    );
    this.plans.set(userId, { limit, until: Date.now() + PLAN_TTL_MS });
    return limit;
  }

  private premiumOffered(): boolean {
    return this.flags.isEnabled("premium-features", false);
  }
}
