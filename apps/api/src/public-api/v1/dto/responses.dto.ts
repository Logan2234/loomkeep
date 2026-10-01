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
  /**
   * Loomkeep's own id for the work, the same for every account.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * The domain the work belongs to.
   * @example "MEDIA"
   */
  @ApiProperty({ enum: STATS_DOMAINS })
  domain!: StatsDomain;

  /**
   * MOVIE, SERIES or ANIME for video; null in the other domains.
   * @example "SERIES"
   */
  @ApiProperty({ enum: Object.values(MediaTypeValues), nullable: true })
  type!: MediaType | null;

  /**
   * The title, in the language asked for when a translation exists (see
   * `lang`).
   * @example "Severance"
   */
  title!: string;

  /**
   * Book authors or album artists; empty for video and games.
   * @example []
   */
  creators!: string[];

  /**
   * Poster or cover image; null when the catalogue has none.
   * @example "https://image.tmdb.org/t/p/w500/lFf6LLrQjYldcZItzOkGmMMigP7.jpg"
   */
  coverUrl!: string | null;

  /**
   * The catalogue the work comes from: TMDB, ANILIST, IGDB, OPEN_LIBRARY or
   * MUSICBRAINZ.
   * @example "TMDB"
   */
  source!: string;

  /**
   * The work's id in that catalogue.
   * @example "95396"
   */
  sourceId!: string;

  /**
   * The work's page in the Loomkeep web app.
   * @example "https://loomkeep.app/app/media/series/95396"
   */
  url!: string;
}

export class ApiV1ProgressResponseDto implements ApiV1ProgressDto {
  /**
   * How far along: episodes watched, current page or minutes played.
   * @example 12
   */
  current!: number;

  /**
   * The total, when known: episodes aired or pages; null for a game's length
   * or a book without a page count.
   * @example 19
   */
  total!: number | null;

  /**
   * What `current` and `total` count.
   * @example "episodes"
   */
  @ApiProperty({ enum: ["episodes", "pages", "minutes"] })
  unit!: "episodes" | "pages" | "minutes";
}

export class ApiV1LibraryEntryResponseDto implements ApiV1LibraryEntryDto {
  /**
   * The library entry's id, for `GET /v1/library/{id}`.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * The domain of the entry.
   * @example "MEDIA"
   */
  @ApiProperty({ enum: STATS_DOMAINS })
  domain!: StatsDomain;

  /**
   * The domain's own status: WATCHING, PLAYING, READ, LISTENED… See the
   * Conventions guide.
   * @example "WATCHING"
   */
  status!: string;

  /**
   * The status normalised across domains, also what `?phase=` filters on.
   * @example "IN_PROGRESS"
   */
  @ApiProperty({ enum: PHASES })
  phase!: ApiV1Phase;

  /**
   * Marked as a favourite.
   * @example true
   */
  favorite!: boolean;

  /**
   * The account's rating, 0 to 10 with half points; null when not rated.
   * @example 8.5
   */
  rating!: number | null;

  /**
   * Private notes on the entry.
   * @example "Rewatch season 1 before season 2"
   */
  notes!: string | null;

  /**
   * When it was started; null when unknown.
   * @example "2026-09-02T20:15:00.000Z"
   */
  startedAt!: string | null;

  /**
   * When it was finished; null when not finished, or unknown.
   * @example "2026-09-28T22:40:00.000Z"
   */
  finishedAt!: string | null;

  /**
   * When it was added to the library.
   * @example "2026-03-14T09:26:53.000Z"
   */
  addedAt!: string;

  /**
   * Episodes for series and anime, pages for books, playtime for games; null
   * otherwise.
   */
  @ApiProperty({ type: ApiV1ProgressResponseDto, nullable: true })
  progress!: ApiV1ProgressResponseDto | null;

  /** The work itself. */
  work!: ApiV1WorkResponseDto;
}

export class ApiV1LibraryPageResponseDto implements PagedResult<ApiV1LibraryEntryDto> {
  /** This page's entries. */
  @ApiProperty({ type: ApiV1LibraryEntryResponseDto, isArray: true })
  items!: ApiV1LibraryEntryResponseDto[];

  /**
   * Whether a next page exists.
   * @example true
   */
  hasMore!: boolean;

  /**
   * Entries matching the filters, across all pages.
   * @example 248
   */
  total!: number;
}

class ApiV1HistoryEpisodeResponseDto {
  /**
   * Season number; 0 holds the specials.
   * @example 2
   */
  seasonNumber!: number;

  /**
   * Episode number within the season.
   * @example 4
   */
  episodeNumber!: number;

  /**
   * The episode's title; null when the catalogue has none.
   * @example "Hide and Seek"
   */
  title!: string | null;
}

class ApiV1HistoryPagesResponseDto {
  /**
   * Pages read during the session.
   * @example 20
   */
  read!: number;

  /**
   * First page of the session, when given.
   * @example 100
   */
  from!: number | null;

  /**
   * Last page of the session, when given.
   * @example 120
   */
  to!: number | null;
}

export class ApiV1HistoryEventResponseDto implements ApiV1HistoryEventDto {
  /**
   * The event's id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * What happened.
   * @example "EPISODE_WATCHED"
   */
  @ApiProperty({ enum: API_V1_HISTORY_EVENT_TYPES })
  type!: ApiV1HistoryEventType;

  /**
   * When it happened; null when unknown (often an import). Undated events
   * only show in their entry's own history.
   * @example "2026-09-30T21:00:00.000Z"
   */
  date!: string | null;

  /**
   * The library entry the event belongs to.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  entryId!: string;

  /** The work involved. */
  work!: ApiV1WorkResponseDto;

  /** The episode, for EPISODE_WATCHED; null otherwise. */
  @ApiProperty({ type: ApiV1HistoryEpisodeResponseDto, nullable: true })
  episode!: ApiV1HistoryEpisodeResponseDto | null;

  /**
   * Viewing (films), playthrough (games) or reading (books) number, 1 for the
   * first; null for episodes, albums and sessions outside a cycle.
   * @example 1
   */
  cycle!: number | null;

  /**
   * A session's length, or the episode's, film's or album's runtime; null
   * when unknown.
   * @example 52
   */
  durationMinutes!: number | null;

  /** Pages read, for BOOK_SESSION; null otherwise. */
  @ApiProperty({ type: ApiV1HistoryPagesResponseDto, nullable: true })
  pages!: ApiV1HistoryPagesResponseDto | null;

  /**
   * The session's own notes; null otherwise.
   * @example "Finally beat the second boss"
   */
  notes!: string | null;
}

export class ApiV1HistoryPageResponseDto implements PagedResult<ApiV1HistoryEventDto> {
  /** This page's events, newest first. */
  @ApiProperty({ type: ApiV1HistoryEventResponseDto, isArray: true })
  items!: ApiV1HistoryEventResponseDto[];

  /**
   * Whether a next page exists.
   * @example true
   */
  hasMore!: boolean;

  /**
   * Events matching the filters, across all pages.
   * @example 1342
   */
  total!: number;
}

export class ApiV1TargetResponseDto implements ApiV1TargetDto {
  /**
   * What the target is: a work (MEDIA, GAME, BOOK, MUSIC), a SEASON or an
   * EPISODE.
   * @example "MEDIA"
   */
  @ApiProperty({ enum: Object.values(ReviewTargetTypeValues) })
  type!: ReviewTargetType;

  /**
   * The target's id; for a work, its Loomkeep id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * The target's title; null when it can't be resolved any more.
   * @example "Dune"
   */
  title!: string | null;

  /**
   * Poster or cover image, when there is one.
   * @example "https://covers.openlibrary.org/b/id/11481354-L.jpg"
   */
  imageUrl!: string | null;

  /**
   * Its page in the web app; null for a target without its own page (a
   * season, an episode).
   * @example "https://loomkeep.app/app/books/OL893415W"
   */
  url!: string | null;
}

export class ApiV1ListResponseDto implements ApiV1ListDto {
  /**
   * The list's id, for `GET /v1/lists/{id}`.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * The list's name.
   * @example "Sci-fi to watch together"
   */
  title!: string;

  /**
   * The list's description, if any.
   * @example "Picked with Julie"
   */
  description!: string | null;

  /**
   * RANKED shows its items in rank order (a top 10), COLLECTION as an
   * unordered set.
   * @example "COLLECTION"
   */
  @ApiProperty({ enum: Object.values(ListKindValues) })
  kind!: ListKind;

  /**
   * Who can see the list.
   * @example "PRIVATE"
   */
  @ApiProperty({ enum: Object.values(ListVisibilityValues) })
  visibility!: ListVisibility;

  /**
   * OWNER for the caller's lists, EDITOR for the ones shared with them.
   * @example "OWNER"
   */
  @ApiProperty({ enum: ["OWNER", "EDITOR"] })
  role!: "OWNER" | "EDITOR";

  /**
   * How many items the list holds.
   * @example 14
   */
  itemCount!: number;

  /**
   * When the list was created.
   * @example "2026-03-14T09:26:53.000Z"
   */
  createdAt!: string;

  /**
   * When the list last changed.
   * @example "2026-09-30T21:00:00.000Z"
   */
  updatedAt!: string;
}

export class ApiV1ListItemResponseDto implements ApiV1ListItemDto {
  /**
   * The item's id within the list.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * Its place in the list, from 0.
   * @example 0
   */
  position!: number;

  /**
   * When it was added to the list.
   * @example "2026-09-30T21:00:00.000Z"
   */
  addedAt!: string;

  /** The work, season or episode. */
  target!: ApiV1TargetResponseDto;
}

export class ApiV1ListDetailResponseDto
  extends ApiV1ListResponseDto
  implements ApiV1ListDetailDto
{
  /** The list's items, in their order. */
  @ApiProperty({ type: ApiV1ListItemResponseDto, isArray: true })
  items!: ApiV1ListItemResponseDto[];
}

export class ApiV1CalendarEpisodeResponseDto implements ApiV1CalendarEpisodeDto {
  /**
   * When the episode airs.
   * @example "2026-10-03T00:00:00.000Z"
   */
  airDate!: string;

  /**
   * Season number.
   * @example 2
   */
  seasonNumber!: number;

  /**
   * Episode number within the season.
   * @example 8
   */
  episodeNumber!: number;

  /**
   * The episode's title, when known yet.
   * @example "Sweet Vitriol"
   */
  episodeTitle!: string | null;

  /**
   * Aired episodes of the same show not watched yet, before this one.
   * @example 1
   */
  episodesBehind!: number;

  /** The show. */
  work!: ApiV1WorkResponseDto;
}

class ApiV1PhaseCountsResponseDto implements Record<ApiV1Phase, number> {
  /**
   * Entries not started yet.
   * @example 112
   */
  PLANNED!: number;

  /**
   * Entries under way.
   * @example 9
   */
  IN_PROGRESS!: number;

  /**
   * Entries finished.
   * @example 431
   */
  DONE!: number;

  /**
   * Entries given up.
   * @example 17
   */
  DROPPED!: number;
}

export class ApiV1DomainStatsResponseDto implements ApiV1DomainStatsDto {
  /**
   * The domain counted.
   * @example "MEDIA"
   */
  @ApiProperty({ enum: STATS_DOMAINS })
  domain!: StatsDomain;

  /**
   * Entries in the domain.
   * @example 569
   */
  total!: number;

  /**
   * Of which favourites.
   * @example 42
   */
  favorites!: number;

  /** Entries per normalised status. */
  byPhase!: ApiV1PhaseCountsResponseDto;
}

class ApiV1VideoStatsResponseDto {
  /**
   * Time spent watching films and episodes, in minutes.
   * @example 182340
   */
  totalMinutes!: number;

  /**
   * Episodes watched, rewatches included.
   * @example 3214
   */
  episodesWatched!: number;
}

class ApiV1GameStatsResponseDto {
  /**
   * Time spent playing, in minutes.
   * @example 24310
   */
  totalPlaytimeMinutes!: number;
}

class ApiV1ReadingGoalResponseDto {
  /**
   * The goal's year.
   * @example 2026
   */
  year!: number;

  /**
   * Books to read that year.
   * @example 24
   */
  target!: number;

  /**
   * Books finished so far that year.
   * @example 17
   */
  completed!: number;
}

class ApiV1BookStatsResponseDto {
  /**
   * Pages read in total.
   * @example 18420
   */
  pagesRead!: number;

  /** This year's reading goal; null when none is set. */
  @ApiProperty({ type: ApiV1ReadingGoalResponseDto, nullable: true })
  readingGoal!: ApiV1ReadingGoalResponseDto | null;
}

class ApiV1MusicStatsResponseDto {
  /**
   * Length of the albums listened to, in minutes.
   * @example 9640
   */
  listenDurationMin!: number;
}

export class ApiV1StatsSummaryResponseDto implements ApiV1StatsSummaryDto {
  /**
   * Entries across the enabled domains.
   * @example 812
   */
  total!: number;

  /**
   * Of which favourites.
   * @example 63
   */
  favorites!: number;

  /**
   * Average of the account's ratings, 0 to 10; null without any.
   * @example 7.4
   */
  averageRating!: number | null;

  /** Counts per enabled domain. */
  @ApiProperty({ type: ApiV1DomainStatsResponseDto, isArray: true })
  domains!: ApiV1DomainStatsResponseDto[];

  /** Video time; null when the domain is turned off for the account. */
  @ApiProperty({ type: ApiV1VideoStatsResponseDto, nullable: true })
  video!: ApiV1VideoStatsResponseDto | null;

  /** Game time; null when the domain is turned off. */
  @ApiProperty({ type: ApiV1GameStatsResponseDto, nullable: true })
  games!: ApiV1GameStatsResponseDto | null;

  /** Reading; null when the domain is turned off. */
  @ApiProperty({ type: ApiV1BookStatsResponseDto, nullable: true })
  books!: ApiV1BookStatsResponseDto | null;

  /** Listening; null when the domain is turned off. */
  @ApiProperty({ type: ApiV1MusicStatsResponseDto, nullable: true })
  music!: ApiV1MusicStatsResponseDto | null;
}

export class ApiV1ReviewResponseDto implements ApiV1ReviewDto {
  /**
   * The review's id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * 0 to 10, half points allowed.
   * @example 9
   */
  rating!: number;

  /**
   * The review's text; null for a rating alone.
   * @example "Slow first act, then it never lets go."
   */
  text!: string | null;

  /**
   * Who can read it.
   * @example "PUBLIC"
   */
  @ApiProperty({ enum: Object.values(ReviewVisibilityValues) })
  visibility!: ReviewVisibility;

  /**
   * Marked as containing spoilers.
   * @example false
   */
  spoiler!: boolean;

  /**
   * When it was first written.
   * @example "2026-03-14T09:26:53.000Z"
   */
  createdAt!: string;

  /**
   * When it last changed.
   * @example "2026-09-30T21:00:00.000Z"
   */
  updatedAt!: string;

  /** The work, season or episode reviewed. */
  target!: ApiV1TargetResponseDto;
}

class ApiV1ProgressionResponseDto {
  /**
   * Experience points earned in total.
   * @example 15240
   */
  xp!: number;

  /**
   * Current level.
   * @example 23
   */
  level!: number;

  /**
   * Points earned since reaching this level.
   * @example 340
   */
  xpInLevel!: number;

  /**
   * Points still needed for the next level.
   * @example 860
   */
  xpToNext!: number;
}

export class ApiV1ProfileResponseDto implements ApiV1ProfileDto {
  /**
   * The account's id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * Unique handle, used in profile URLs.
   * @example "alice"
   */
  username!: string;

  /**
   * Name shown in the app.
   * @example "Alice Martin"
   */
  displayName!: string;

  /**
   * The profile's bio, if any.
   * @example "Mostly anime and slow sci-fi."
   */
  bio!: string | null;

  /**
   * Avatar image, if one was uploaded.
   * @example "https://loomkeep.app/api/users/cm1q2w3e4r5t6y7u8i9o0p1a/avatar"
   */
  avatarUrl!: string | null;

  /**
   * When the account was created.
   * @example "2026-03-14T09:26:53.000Z"
   */
  memberSince!: string;

  /**
   * Level and experience; null when gamification is turned off on this
   * instance.
   */
  @ApiProperty({ type: ApiV1ProgressionResponseDto, nullable: true })
  progression!: ApiV1ProgressionResponseDto | null;
}

class ApiV1AchievementProgressResponseDto {
  /**
   * Progress so far.
   * @example 37
   */
  current!: number;

  /**
   * What unlocking takes.
   * @example 50
   */
  target!: number;
}

export class ApiV1AchievementResponseDto implements ApiV1AchievementDto {
  /**
   * The achievement's key; null for a secret achievement not unlocked yet.
   * @example "episodes_watched_bronze"
   */
  key!: string | null;

  /**
   * The family it belongs to.
   * @example "episodes_watched"
   */
  family!: string;

  /**
   * Its tier within the family, if tiered.
   * @example "bronze"
   */
  tier!: string | null;

  /**
   * Whether the account has it.
   * @example true
   */
  unlocked!: boolean;

  /**
   * When it was unlocked.
   * @example "2026-09-30T21:00:00.000Z"
   */
  unlockedAt!: string | null;

  /** Progress towards it; null once unlocked or when it can't be measured. */
  @ApiProperty({ type: ApiV1AchievementProgressResponseDto, nullable: true })
  progress!: ApiV1AchievementProgressResponseDto | null;
}

export class ApiV1NotificationResponseDto implements ApiV1NotificationDto {
  /**
   * The notification's id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * What kind of notification it is (NEW_EPISODE, FOLLOW_REQUEST…).
   * @example "NEW_EPISODE"
   */
  type!: string;

  /**
   * Its title, as stored.
   * @example "Severance"
   */
  title!: string;

  /**
   * Its text, if any.
   * @example "S02E08 is out"
   */
  body!: string | null;

  /**
   * Where it leads in the web app, if anywhere.
   * @example "https://loomkeep.app/app/media/series/95396"
   */
  url!: string | null;

  /**
   * The episode's air date for a new episode, else when it was created.
   * @example "2026-09-30T21:00:00.000Z"
   */
  date!: string;

  /**
   * When it was created.
   * @example "2026-09-30T21:00:00.000Z"
   */
  createdAt!: string;
}

export class ApiV1NotificationsResponseDto implements ApiV1NotificationsDto {
  /**
   * Notifications not read yet.
   * @example 3
   */
  unread!: number;

  /** The most recent notifications, newest first. */
  @ApiProperty({ type: ApiV1NotificationResponseDto, isArray: true })
  items!: ApiV1NotificationResponseDto[];
}
