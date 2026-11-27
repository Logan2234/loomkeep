import { ErrorCode } from "@loomkeep/shared/catalog";
import {
  Domain,
  PREMIUM_DOMAINS,
  type ReviewTargetType,
} from "@loomkeep/shared/enums";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../common/app.exception";
import { EntitlementService } from "../entitlements/entitlement.service";
import { instanceDomains } from "../instance-settings/instance-domains";
import { PrismaService } from "../prisma/prisma.service";

/** The domain a review, list item or comment target belongs to. */
export const TARGET_DOMAIN = {
  MEDIA: Domain.MEDIA,
  SEASON: Domain.MEDIA,
  EPISODE: Domain.MEDIA,
  GAME: Domain.GAMES,
  BOOK: Domain.BOOKS,
  MUSIC: Domain.MUSIC,
} as const satisfies Record<ReviewTargetType, Domain>;

/**
 * Enforces `User.enabledDomains` server-side: a domain the user turned off is
 * not just hidden from the nav, it is unreachable. Called by the per-domain
 * search endpoints so a disabled domain returns 403 instead of results.
 *
 * Also intersects with the domains the instance offers (`instanceDomains`):
 * one the admin turned off, or without its catalogue key, is unreachable for
 * every user, whatever their own `enabledDomains`. And with
 * `PREMIUM_DOMAINS` — a free user keeps these unreachable even if their own
 * `enabledDomains` still lists one (e.g. from before it became premium-gated).
 */
@Injectable()
export class DomainGateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly entitlements: EntitlementService,
  ) {}

  /** Throws 403 unless the user keeps `domain` enabled. */
  async assertEnabled(userId: string, domain: Domain): Promise<void> {
    const enabled = await this.getEnabledDomains(userId);

    if (!enabled.includes(domain)) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.UserDomainDisabled,
        { domain },
        `Domain '${domain}' is disabled`,
      );
    }
  }

  /** The domains this user keeps enabled, among those the instance offers. */
  async getEnabledDomains(userId: string): Promise<Domain[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { enabledDomains: true },
    });

    const offered = instanceDomains(this.config);
    const enabled = (user?.enabledDomains ?? []).filter((domain) =>
      offered.includes(domain),
    );

    if (!enabled.some((domain) => PREMIUM_DOMAINS.includes(domain))) {
      return enabled;
    }

    const hasPremium = await this.entitlements.isEffectivelyPremium(userId);
    return hasPremium
      ? enabled
      : enabled.filter((domain) => !PREMIUM_DOMAINS.includes(domain));
  }
}
