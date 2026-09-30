import type {
  ApiV1AchievementDto,
  ApiV1ListDetailDto,
  ApiV1ListDto,
  ApiV1NotificationsDto,
  ApiV1ProfileDto,
  ApiV1ReviewDto,
  ApiV1StatsSummaryDto,
  ReviewTargetType,
  StatsDomain,
  UserDataExportDto,
} from "@loomkeep/shared";
import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AllowApiKey } from "../../../api-keys/api-key-access.decorator";
import type { JwtPayload } from "../../../auth/decorators/current-user.decorator";
import { CurrentUser } from "../../../auth/decorators/current-user.decorator";
import { GamificationFeatureGuard } from "../../../gamification/gamification-feature.guard";
import { NotificationService } from "../../../notifications/notification.service";
import { ReviewService } from "../../../reviews/review.service";
import { DataExportService } from "../../../users/data-export.service";
import { UserDataExportResponseDto } from "../../../users/dto/data-export/user-data-export-response.dto";
import { ReviewsQueryDto } from "../dto/queries.dto";
import {
  ApiV1AchievementResponseDto,
  ApiV1ListDetailResponseDto,
  ApiV1ListResponseDto,
  ApiV1NotificationsResponseDto,
  ApiV1ProfileResponseDto,
  ApiV1ReviewResponseDto,
  ApiV1StatsSummaryResponseDto,
} from "../dto/responses.dto";
import { webOriginOf } from "../library-v1.service";
import { ListsV1Service } from "../lists-v1.service";
import { toTarget, webUrl } from "../mappers";
import { ProfileV1Service } from "../profile-v1.service";
import { StatsV1Service } from "../stats-v1.service";

const REVIEW_TARGETS: Record<StatsDomain, ReviewTargetType[]> = {
  MEDIA: ["MEDIA", "SEASON", "EPISODE"],
  GAMES: ["GAME"],
  BOOKS: ["BOOK"],
  MUSIC: ["MUSIC"],
};

@ApiTags("Lists")
@ApiBearerAuth()
@AllowApiKey("lists")
@Controller({ path: "lists", version: "1" })
export class ListsV1Controller {
  constructor(private readonly lists: ListsV1Service) {}

  @Get()
  @ApiOperation({
    summary: "List lists",
    description: "The caller's lists, plus the ones shared with them.",
  })
  @ApiOkResponse({ type: ApiV1ListResponseDto, isArray: true })
  list(@CurrentUser() user: JwtPayload): Promise<ApiV1ListDto[]> {
    return this.lists.list(user.sub);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a list and its items" })
  @ApiOkResponse({ type: ApiV1ListDetailResponseDto })
  get(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<ApiV1ListDetailDto> {
    return this.lists.get(user.sub, id);
  }
}

@ApiTags("Stats")
@ApiBearerAuth()
@AllowApiKey("stats")
@Controller({ path: "stats", version: "1" })
export class StatsV1Controller {
  constructor(private readonly stats: StatsV1Service) {}

  @Get("summary")
  @ApiOperation({
    summary: "Stats summary",
    description:
      "Counts per domain and normalised status, time spent, and this year's reading goal.",
  })
  @ApiOkResponse({ type: ApiV1StatsSummaryResponseDto })
  summary(@CurrentUser() user: JwtPayload): Promise<ApiV1StatsSummaryDto> {
    return this.stats.summary(user.sub);
  }
}

@ApiTags("Reviews")
@ApiBearerAuth()
@AllowApiKey("reviews")
@Controller({ path: "reviews", version: "1" })
export class ReviewsV1Controller {
  private readonly webOrigin: string;

  constructor(
    config: ConfigService,
    private readonly reviews: ReviewService,
  ) {
    this.webOrigin = webOriginOf(config);
  }

  @Get()
  @ApiOperation({ summary: "List the caller's reviews and ratings" })
  @ApiOkResponse({ type: ApiV1ReviewResponseDto, isArray: true })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ReviewsQueryDto,
  ): Promise<ApiV1ReviewDto[]> {
    const reviews = await this.reviews.listMine(user.sub);
    const targets = query.domain ? REVIEW_TARGETS[query.domain] : null;
    return reviews
      .filter((review) => !targets || targets.includes(review.targetType))
      .map((review) => ({
        id: review.id,
        rating: review.rating,
        text: review.text,
        visibility: review.visibility,
        spoiler: review.spoilerTag,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        target: toTarget(
          review.targetType,
          review.targetId,
          review.target,
          this.webOrigin,
        ),
      }));
  }
}

@ApiTags("Profile")
@ApiBearerAuth()
@AllowApiKey("profile")
@Controller({ path: "profile", version: "1" })
export class ProfileV1Controller {
  constructor(private readonly profile: ProfileV1Service) {}

  @Get()
  @ApiOperation({
    summary: "The caller's profile and progression",
    description:
      "`progression` is null when gamification is off on this instance.",
  })
  @ApiOkResponse({ type: ApiV1ProfileResponseDto })
  get(@CurrentUser() user: JwtPayload): Promise<ApiV1ProfileDto> {
    return this.profile.get(user.sub);
  }

  @Get("achievements")
  @UseGuards(GamificationFeatureGuard)
  @ApiOperation({
    summary: "The caller's achievements",
    description: "404 when gamification is off on this instance.",
  })
  @ApiOkResponse({ type: ApiV1AchievementResponseDto, isArray: true })
  achievements(
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiV1AchievementDto[]> {
    return this.profile.achievements(user.sub);
  }
}

@ApiTags("Notifications")
@ApiBearerAuth()
@AllowApiKey("notifications")
@Controller({ path: "notifications", version: "1" })
export class NotificationsV1Controller {
  private readonly webOrigin: string;

  constructor(
    config: ConfigService,
    private readonly notifications: NotificationService,
  ) {
    this.webOrigin = webOriginOf(config);
  }

  @Get()
  @ApiOperation({ summary: "The caller's notification bell" })
  @ApiOkResponse({ type: ApiV1NotificationsResponseDto })
  async list(@CurrentUser() user: JwtPayload): Promise<ApiV1NotificationsDto> {
    const feed = await this.notifications.feed(user.sub);
    return {
      unread: feed.unread,
      items: feed.notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        url: n.url ? webUrl(this.webOrigin, n.url) : null,
        date: n.timestamp,
        createdAt: n.createdAt,
      })),
    };
  }
}

@ApiTags("Export")
@ApiBearerAuth()
@AllowApiKey("export")
@Controller({ path: "export", version: "1" })
export class ExportV1Controller {
  constructor(private readonly dataExport: DataExportService) {}

  /** Same pace as the in-app export: a full snapshot, once an hour. */
  @Throttle({ default: { limit: 1, ttl: 3_600_000 } })
  @Get()
  @ApiOperation({
    summary: "Full data export",
    description:
      "Everything the account holds, in the same format as Settings › Export. Once an hour.",
  })
  @ApiOkResponse({ type: UserDataExportResponseDto })
  export(@CurrentUser() user: JwtPayload): Promise<UserDataExportDto> {
    return this.dataExport.buildExport(user.sub);
  }
}
