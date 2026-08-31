import type {
  AdminAccountsSectionDto,
  AdminCatalogueSectionDto,
  AdminNewAccountsTrendDto,
  AdminSocialActivityTrendDto,
  AdminSocialSectionDto,
  AdminSystemSectionDto,
  TrendPeriod,
} from "@loomkeep/shared";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from "@nestjs/swagger";
import { AdminAccountsStatsService } from "./admin-accounts-stats.service";
import { AdminCatalogueStatsService } from "./admin-catalogue-stats.service";
import { AdminOnly } from "./admin-only.decorator";
import { AdminSocialStatsService } from "./admin-social-stats.service";
import { AdminSystemStatsService } from "./admin-system-stats.service";
import { AdminAccountsSectionResponseDto } from "./dto/admin-accounts-section-response.dto";
import { AdminCatalogueSectionResponseDto } from "./dto/admin-catalogue-section-response.dto";
import { AdminNewAccountsTrendResponseDto } from "./dto/admin-new-accounts-trend-response.dto";
import { AdminSocialActivityTrendResponseDto } from "./dto/admin-social-activity-trend-response.dto";
import {
  DisabledSocialSectionResponseDto,
  EnabledSocialSectionResponseDto,
} from "./dto/admin-social-section-response.dto";
import { AdminSystemSectionResponseDto } from "./dto/admin-system-section-response.dto";

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
  @ApiOkResponse({ type: AdminAccountsSectionResponseDto })
  getAccounts(): Promise<AdminAccountsSectionDto> {
    return this.accounts.getStats();
  }

  /** Registration curve alone, so the card's period picker doesn't recompute cohorts. */
  @Get("accounts/new")
  @ApiOkResponse({ type: AdminNewAccountsTrendResponseDto })
  getNewAccounts(
    @Query("period") period?: string,
  ): Promise<AdminNewAccountsTrendDto> {
    return this.accounts.getNewAccountsTrend(resolvePeriod(period));
  }

  @Get("catalogue")
  @ApiOkResponse({ type: AdminCatalogueSectionResponseDto })
  getCatalogue(): Promise<AdminCatalogueSectionDto> {
    return this.catalogue.getStats();
  }

  @Get("social")
  @ApiExtraModels(
    DisabledSocialSectionResponseDto,
    EnabledSocialSectionResponseDto,
  )
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(DisabledSocialSectionResponseDto) },
        { $ref: getSchemaPath(EnabledSocialSectionResponseDto) },
      ],
    },
  })
  getSocial(): Promise<AdminSocialSectionDto> {
    return this.social.getSection();
  }

  /** Social activity curve alone, so the card's period picker doesn't recompute the totals. */
  @Get("social/activity")
  @ApiOkResponse({ type: AdminSocialActivityTrendResponseDto })
  getSocialActivity(
    @Query("period") period?: string,
  ): Promise<AdminSocialActivityTrendDto> {
    return this.social.getActivityTrend(resolvePeriod(period));
  }

  @Get("system")
  @ApiOkResponse({ type: AdminSystemSectionResponseDto })
  getSystem(): Promise<AdminSystemSectionDto> {
    return this.system.getStats();
  }
}
