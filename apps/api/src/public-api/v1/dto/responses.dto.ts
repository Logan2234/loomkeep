import type {
  ApiV1AchievementDto,
  ApiV1CalendarEpisodeDto,
  ApiV1DomainStatsDto,
  ApiV1HistoryEventDto,
  ApiV1HistoryEventType,
  ApiV1LibraryEntryDto,
  ApiV1ListDetailDto,
  ApiV1ListDto,
  ApiV1ListItemDto,
  ApiV1NotificationDto,
  ApiV1NotificationsDto,
  ApiV1Phase,
  ApiV1ProfileDto,
  ApiV1ProgressDto,
  ApiV1ReviewDto,
  ApiV1StatsSummaryDto,
  ApiV1TargetDto,
  ApiV1WorkDto,
  ListKind,
  ListVisibility,
  MediaType,
  PagedResult,
  ReviewTargetType,
  ReviewVisibility,
  StatsDomain,
} from "@loomkeep/shared";
import {
  API_V1_HISTORY_EVENT_TYPES,
  ListKind as ListKindValues,
  ListVisibility as ListVisibilityValues,
  MediaType as MediaTypeValues,
  ReviewTargetType as ReviewTargetTypeValues,
  ReviewVisibility as ReviewVisibilityValues,
  STATS_DOMAINS,
  StatsStatusBucket,
} from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

const PHASES = Object.values(StatsStatusBucket);

export class ApiV1WorkResponseDto implements ApiV1WorkDto {
  id!: string;
  @ApiProperty({ enum: STATS_DOMAINS })
  domain!: StatsDomain;

  @ApiProperty({ enum: Object.values(MediaTypeValues), nullable: true })
  type!: MediaType | null;

  title!: string;
  creators!: string[];
  coverUrl!: string | null;
  source!: string;
  sourceId!: string;
  url!: string;
}

export class ApiV1ProgressResponseDto implements ApiV1ProgressDto {
  current!: number;
  total!: number | null;
  @ApiProperty({ enum: ["episodes", "pages", "minutes"] })
  unit!: "episodes" | "pages" | "minutes";
}

export class ApiV1LibraryEntryResponseDto implements ApiV1LibraryEntryDto {
  id!: string;
  @ApiProperty({ enum: STATS_DOMAINS })
  domain!: StatsDomain;

  status!: string;
  @ApiProperty({ enum: PHASES })
  phase!: ApiV1Phase;

  favorite!: boolean;
  rating!: number | null;
  notes!: string | null;
  startedAt!: string | null;
  finishedAt!: string | null;
  addedAt!: string;
  @ApiProperty({ type: ApiV1ProgressResponseDto, nullable: true })
  progress!: ApiV1ProgressResponseDto | null;

  work!: ApiV1WorkResponseDto;
}

export class ApiV1LibraryPageResponseDto implements PagedResult<ApiV1LibraryEntryDto> {
  @ApiProperty({ type: ApiV1LibraryEntryResponseDto, isArray: true })
  items!: ApiV1LibraryEntryResponseDto[];

  hasMore!: boolean;
  total!: number;
}

class ApiV1HistoryEpisodeResponseDto {
  seasonNumber!: number;
  episodeNumber!: number;
  title!: string | null;
}

class ApiV1HistoryPagesResponseDto {
  read!: number;
  from!: number | null;
  to!: number | null;
}

export class ApiV1HistoryEventResponseDto implements ApiV1HistoryEventDto {
  id!: string;
  @ApiProperty({ enum: API_V1_HISTORY_EVENT_TYPES })
  type!: ApiV1HistoryEventType;

  date!: string | null;
  entryId!: string;
  work!: ApiV1WorkResponseDto;
  @ApiProperty({ type: ApiV1HistoryEpisodeResponseDto, nullable: true })
  episode!: ApiV1HistoryEpisodeResponseDto | null;

  cycle!: number | null;
  durationMinutes!: number | null;
  @ApiProperty({ type: ApiV1HistoryPagesResponseDto, nullable: true })
  pages!: ApiV1HistoryPagesResponseDto | null;

  notes!: string | null;
}

export class ApiV1HistoryPageResponseDto implements PagedResult<ApiV1HistoryEventDto> {
  @ApiProperty({ type: ApiV1HistoryEventResponseDto, isArray: true })
  items!: ApiV1HistoryEventResponseDto[];

  hasMore!: boolean;
  total!: number;
}

export class ApiV1TargetResponseDto implements ApiV1TargetDto {
  @ApiProperty({ enum: Object.values(ReviewTargetTypeValues) })
  type!: ReviewTargetType;

  id!: string;
  title!: string | null;
  imageUrl!: string | null;
  url!: string | null;
}

export class ApiV1ListResponseDto implements ApiV1ListDto {
  id!: string;
  title!: string;
  description!: string | null;
  @ApiProperty({ enum: Object.values(ListKindValues) })
  kind!: ListKind;

  @ApiProperty({ enum: Object.values(ListVisibilityValues) })
  visibility!: ListVisibility;

  @ApiProperty({ enum: ["OWNER", "EDITOR"] })
  role!: "OWNER" | "EDITOR";

  itemCount!: number;
  createdAt!: string;
  updatedAt!: string;
}

export class ApiV1ListItemResponseDto implements ApiV1ListItemDto {
  id!: string;
  position!: number;
  addedAt!: string;
  target!: ApiV1TargetResponseDto;
}

export class ApiV1ListDetailResponseDto
  extends ApiV1ListResponseDto
  implements ApiV1ListDetailDto
{
  @ApiProperty({ type: ApiV1ListItemResponseDto, isArray: true })
  items!: ApiV1ListItemResponseDto[];
}

export class ApiV1CalendarEpisodeResponseDto implements ApiV1CalendarEpisodeDto {
  airDate!: string;
  seasonNumber!: number;
  episodeNumber!: number;
  episodeTitle!: string | null;
  episodesBehind!: number;
  work!: ApiV1WorkResponseDto;
}

class ApiV1PhaseCountsResponseDto implements Record<ApiV1Phase, number> {
  PLANNED!: number;
  IN_PROGRESS!: number;
  DONE!: number;
  DROPPED!: number;
}

export class ApiV1DomainStatsResponseDto implements ApiV1DomainStatsDto {
  @ApiProperty({ enum: STATS_DOMAINS })
  domain!: StatsDomain;

  total!: number;
  favorites!: number;
  byPhase!: ApiV1PhaseCountsResponseDto;
}

class ApiV1VideoStatsResponseDto {
  totalMinutes!: number;
  episodesWatched!: number;
}

class ApiV1GameStatsResponseDto {
  totalPlaytimeMinutes!: number;
}

class ApiV1ReadingGoalResponseDto {
  year!: number;
  target!: number;
  completed!: number;
}

class ApiV1BookStatsResponseDto {
  pagesRead!: number;
  @ApiProperty({ type: ApiV1ReadingGoalResponseDto, nullable: true })
  readingGoal!: ApiV1ReadingGoalResponseDto | null;
}

class ApiV1MusicStatsResponseDto {
  listenDurationMin!: number;
}

export class ApiV1StatsSummaryResponseDto implements ApiV1StatsSummaryDto {
  total!: number;
  favorites!: number;
  averageRating!: number | null;
  @ApiProperty({ type: ApiV1DomainStatsResponseDto, isArray: true })
  domains!: ApiV1DomainStatsResponseDto[];

  @ApiProperty({ type: ApiV1VideoStatsResponseDto, nullable: true })
  video!: ApiV1VideoStatsResponseDto | null;

  @ApiProperty({ type: ApiV1GameStatsResponseDto, nullable: true })
  games!: ApiV1GameStatsResponseDto | null;

  @ApiProperty({ type: ApiV1BookStatsResponseDto, nullable: true })
  books!: ApiV1BookStatsResponseDto | null;

  @ApiProperty({ type: ApiV1MusicStatsResponseDto, nullable: true })
  music!: ApiV1MusicStatsResponseDto | null;
}

export class ApiV1ReviewResponseDto implements ApiV1ReviewDto {
  id!: string;
  rating!: number;
  text!: string | null;
  @ApiProperty({ enum: Object.values(ReviewVisibilityValues) })
  visibility!: ReviewVisibility;

  spoiler!: boolean;
  createdAt!: string;
  updatedAt!: string;
  target!: ApiV1TargetResponseDto;
}

class ApiV1ProgressionResponseDto {
  xp!: number;
  level!: number;
  xpInLevel!: number;
  xpToNext!: number;
}

export class ApiV1ProfileResponseDto implements ApiV1ProfileDto {
  id!: string;
  username!: string;
  displayName!: string;
  bio!: string | null;
  avatarUrl!: string | null;
  memberSince!: string;
  @ApiProperty({ type: ApiV1ProgressionResponseDto, nullable: true })
  progression!: ApiV1ProgressionResponseDto | null;
}

class ApiV1AchievementProgressResponseDto {
  current!: number;
  target!: number;
}

export class ApiV1AchievementResponseDto implements ApiV1AchievementDto {
  key!: string | null;
  family!: string;
  tier!: string | null;
  unlocked!: boolean;
  unlockedAt!: string | null;
  @ApiProperty({ type: ApiV1AchievementProgressResponseDto, nullable: true })
  progress!: ApiV1AchievementProgressResponseDto | null;
}

export class ApiV1NotificationResponseDto implements ApiV1NotificationDto {
  id!: string;
  type!: string;
  title!: string;
  body!: string | null;
  url!: string | null;
  date!: string;
  createdAt!: string;
}

export class ApiV1NotificationsResponseDto implements ApiV1NotificationsDto {
  unread!: number;
  @ApiProperty({ type: ApiV1NotificationResponseDto, isArray: true })
  items!: ApiV1NotificationResponseDto[];
}
