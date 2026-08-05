import { Controller, Get, Query } from "@nestjs/common";
import type {
  AdminAccountsSectionDto,
  AdminCatalogueSectionDto,
  AdminNewAccountsTrendDto,
  AdminSocialActivityTrendDto,
  AdminSocialSectionDto,
  AdminSystemSectionDto,
  TrendPeriod,
} from "@tracklore/shared";
import { AdminAccountsStatsService } from "./admin-accounts-stats.service";
import { AdminCatalogueStatsService } from "./admin-catalogue-stats.service";
import { AdminOnly } from "./admin-only.decorator";
import { AdminSocialStatsService } from "./admin-social-stats.service";
import { AdminSystemStatsService } from "./admin-system-stats.service";

const PERIODS: TrendPeriod[] = ["day", "week", "month", "year"];

function resolvePeriod(period?: string): TrendPeriod {
  return PERIODS.includes(period as TrendPeriod)
    ? (period as TrendPeriod)
    : "week";
}

/**
 * /admin/stats, one endpoint per section of the page: each section is heavy
 * enough to be worth loading (and failing) on its own, and the page renders
 * whichever ones answered.
 *
 * The social section carries its own `enabled` flag rather than sitting behind
 * `SocialFeatureGuard` — a 404 would take the whole card down with no way to
 * say why, and this is a block of an admin page, not a social route.
 */
@AdminOnly()
@Controller("admin/stats")
export class AdminStatsController {
  constructor(
    private readonly accounts: AdminAccountsStatsService,
    private readonly catalogue: AdminCatalogueStatsService,
    private readonly social: AdminSocialStatsService,
    private readonly system: AdminSystemStatsService,
  ) {}

  @Get("accounts")
  getAccounts(): Promise<AdminAccountsSectionDto> {
    return this.accounts.getStats();
  }

  /** Registration curve alone, so the card's period picker doesn't recompute cohorts. */
  @Get("accounts/new")
  getNewAccounts(
    @Query("period") period?: string,
  ): Promise<AdminNewAccountsTrendDto> {
    return this.accounts.getNewAccountsTrend(resolvePeriod(period));
  }

  @Get("catalogue")
  getCatalogue(): Promise<AdminCatalogueSectionDto> {
    return this.catalogue.getStats();
  }

  @Get("social")
  getSocial(): Promise<AdminSocialSectionDto> {
    return this.social.getSection();
  }

  /** Social activity curve alone, so the card's period picker doesn't recompute the totals. */
  @Get("social/activity")
  getSocialActivity(
    @Query("period") period?: string,
  ): Promise<AdminSocialActivityTrendDto> {
    return this.social.getActivityTrend(resolvePeriod(period));
  }

  @Get("system")
  getSystem(): Promise<AdminSystemSectionDto> {
    return this.system.getStats();
  }
}
