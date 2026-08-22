import { ForbiddenException, Injectable } from "@nestjs/common";
import { Domain } from "@loomkeep/shared";
import { EntitlementService } from "../entitlements/entitlement.service";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { PrismaService } from "../prisma/prisma.service";

// Early-access domains, gated behind premium regardless of the user's own
// `enabledDomains` toggle — see docs/adr/0001-open-core-agpl.md. PODCASTS and
// BOARDGAMES have no backing screens yet ("coming soon"), listed here so
// they're already gated the moment they ship, with no extra change needed.
const PREMIUM_DOMAINS: readonly Domain[] = [
  Domain.MUSIC,
  Domain.PODCASTS,
  Domain.BOARDGAMES,
];

/**
 * Enforces `User.enabledDomains` server-side: a domain the user turned off is
 * not just hidden from the nav, it is unreachable. Called by the per-domain
 * search endpoints so a disabled domain returns 403 instead of results.
 *
 * Also intersects with the deployment-wide `MAINTENANCE_<DOMAIN>` Unleash
 * flags (see FeatureFlagsService) — a domain an admin put in maintenance is
 * unreachable for every user, exactly as if they had turned it off
 * themselves, regardless of their own `enabledDomains`. And with
 * `PREMIUM_DOMAINS` — a free user keeps these unreachable even if their own
 * `enabledDomains` still lists one (e.g. from before it became premium-gated).
 */
@Injectable()
export class DomainGateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
    private readonly entitlements: EntitlementService,
  ) {}

  /** Throws 403 unless the user keeps `domain` enabled. */
  async assertEnabled(userId: string, domain: Domain): Promise<void> {
    const enabled = await this.getEnabledDomains(userId);

    if (!enabled.includes(domain)) {
      throw new ForbiddenException(`Domain '${domain}' is disabled`);
    }
  }

  /** The domains this user currently keeps enabled and that aren't under maintenance. */
  async getEnabledDomains(userId: string): Promise<Domain[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { enabledDomains: true },
    });

    const enabled = (user?.enabledDomains ?? []).filter(
      (domain) => !this.flags.isEnabled(`MAINTENANCE_${domain}`),
    );

    if (!enabled.some((domain) => PREMIUM_DOMAINS.includes(domain))) {
      return enabled;
    }

    const hasPremium = await this.entitlements.hasPremium(userId);
    return hasPremium
      ? enabled
      : enabled.filter((domain) => !PREMIUM_DOMAINS.includes(domain));
  }
}
