import type {
  BookStatsDto,
  GameStatsDto,
  MusicStatsDto,
  SocialStatsDto,
  StatsDomain,
  StatsOverviewDto,
  StatsWindow,
  StatsWorkDto,
  VideoStatsDto,
  VideoTemporalDto,
  WatchStaleness,
} from "@loomkeep/shared";
import { Domain, STATS_DOMAINS } from "@loomkeep/shared";
import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { parseEnumParam } from "../common/parse-enum-param.util";
import { EntitlementService } from "../entitlements/entitlement.service";
import { SocialFeatureGuard } from "../social/social-feature.guard";
import { DomainGateService } from "../users/domain-gate.service";
import { StatsService } from "./stats.service";

const DOMAIN_CHOICES = ["ALL", ...STATS_DOMAINS] as const;
const STALENESS_CHOICES = ["PAUSED", "GHOST"] as const;
const WINDOW_CHOICES = ["ALL", "YEAR", "MONTH", "WEEK"] as const;

@Controller("stats")
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly domainGate: DomainGateService,
    private readonly entitlements: EntitlementService,
  ) {}

  @Get("overview")
  async getOverview(
    @CurrentUser() user: JwtPayload,
    @Query("domain") domainParam = "ALL",
  ): Promise<StatsOverviewDto> {
    const domain = parseDomain(domainParam);

    if (domain !== "ALL") {
      await this.domainGate.assertEnabled(user.sub, domain);
    }

    const premium = await this.entitlements.isEffectivelyPremium(user.sub);
    return this.statsService.getOverview(user.sub, domain, premium);
  }

  @Get("works")
  async getWorks(
    @CurrentUser() user: JwtPayload,
    @Query("domain") domainParam = "ALL",
    @Query("rating") ratingParam?: string,
    @Query("decade") decadeParam?: string,
  ): Promise<StatsWorkDto[]> {
    const domain = parseDomain(domainParam);

    if (domain !== "ALL") {
      await this.domainGate.assertEnabled(user.sub, domain);
    }

    const filter = parseWorksFilter(ratingParam, decadeParam);
    return this.statsService.getWorks(user.sub, domain, filter);
  }

  @Get("video")
  async getVideoStats(@CurrentUser() user: JwtPayload): Promise<VideoStatsDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.MEDIA);
    const premium = await this.entitlements.isEffectivelyPremium(user.sub);
    return this.statsService.getVideoStats(user.sub, premium);
  }

  @Get("video/series")
  async getVideoSeries(
    @CurrentUser() user: JwtPayload,
    @Query("kind") kindParam: string,
  ): Promise<StatsWorkDto[]> {
    await this.domainGate.assertEnabled(user.sub, Domain.MEDIA);
    const kind = parseEnumParam(
      kindParam,
      STALENESS_CHOICES,
      "series kind",
    ) as WatchStaleness;
    return this.statsService.getVideoSeries(user.sub, kind);
  }

  @Get("video/temporal")
  async getVideoTemporal(
    @CurrentUser() user: JwtPayload,
    @Query("period") periodParam = "ALL",
  ): Promise<VideoTemporalDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.MEDIA);
    const period = parseEnumParam(
      periodParam,
      WINDOW_CHOICES,
      "stats window",
    ) as StatsWindow;
    const premium = await this.entitlements.isEffectivelyPremium(user.sub);
    return this.statsService.getVideoTemporal(user.sub, period, premium);
  }

  @Get("games")
  async getGameStats(@CurrentUser() user: JwtPayload): Promise<GameStatsDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.GAMES);
    const premium = await this.entitlements.isEffectivelyPremium(user.sub);
    return this.statsService.getGameStats(user.sub, premium);
  }

  @Get("books")
  async getBookStats(@CurrentUser() user: JwtPayload): Promise<BookStatsDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.BOOKS);
    const premium = await this.entitlements.isEffectivelyPremium(user.sub);
    return this.statsService.getBookStats(user.sub, premium);
  }

  @Get("music")
  async getMusicStats(@CurrentUser() user: JwtPayload): Promise<MusicStatsDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.MUSIC);
    const premium = await this.entitlements.isEffectivelyPremium(user.sub);
    return this.statsService.getMusicStats(user.sub, premium);
  }

  @Get("social")
  @UseGuards(SocialFeatureGuard)
  async getSocialStats(
    @CurrentUser() user: JwtPayload,
  ): Promise<SocialStatsDto> {
    const premium = await this.entitlements.isEffectivelyPremium(user.sub);
    return this.statsService.getSocialStats(user.sub, premium);
  }
}

function parseDomain(value: string): StatsDomain | "ALL" {
  return parseEnumParam(value, DOMAIN_CHOICES, "stats domain");
}

function parseWorksFilter(
  ratingParam?: string,
  decadeParam?: string,
): { rating?: number; decade?: number } {
  if (ratingParam !== undefined && decadeParam !== undefined) {
    throw new BadRequestException("Pass either 'rating' or 'decade', not both");
  }

  if (ratingParam !== undefined) {
    const rating = Number(ratingParam);

    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      throw new BadRequestException("'rating' must be an integer 1-10");
    }

    return { rating };
  }

  if (decadeParam !== undefined) {
    const decade = Number(decadeParam);

    if (!Number.isInteger(decade) || decade % 10 !== 0) {
      throw new BadRequestException("'decade' must be a multiple of 10");
    }

    return { decade };
  }

  throw new BadRequestException("Pass either 'rating' or 'decade'");
}
