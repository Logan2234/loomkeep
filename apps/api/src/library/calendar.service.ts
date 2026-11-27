import type { CalendarEntryDto } from "@loomkeep/shared/contracts";
import { movieReleaseDates, movieReleaseInfo } from "@loomkeep/shared/rules";
import { Injectable } from "@nestjs/common";
import { addDays } from "../common/date.util";
import { localDayOrUtc, startOfLocalDay } from "../common/local-day.util";
import { toGameItemDto } from "../games/game-item.mapper";
import { toMediaItemDto } from "../media/media-item.mapper";
import { resolveWatchRegion } from "../media/watch-region.util";
import { PrismaService } from "../prisma/prisma.service";

/** How far ahead the calendar lists episodes: about six months. */
const EPISODE_WINDOW_DAYS = 183;
/**
 * Bounds the episode list for someone following many daily shows. A count
 * alone used to be the only bound (60): a few daily shows filled it within
 * days, hiding every later episode while films months away still showed.
 */
const MAX_EPISODES = 500;

/**
 * The release calendar: upcoming episodes, local movie releases and game
 * releases of what the user tracks, across domains. Read by the calendar
 * page, the public API, the home-screen widgets and the .ics feed.
 */
@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upcoming local movie releases and episodes (air date today or later) of the series/anime the user
   * tracks, excluding dropped ones — the release calendar. Shows with muted
   * alerts stay listed: muting only silences the digest. Each carries the
   * show's backlog (`episodesBehind`), counted up to the start of today so
   * an episode airing today is never its own backlog. "Today" is the user's,
   * from `User.timezone`, not the server's UTC day.
   */
  async getCalendar(
    userId: string,
    acceptLanguage?: string,
  ): Promise<CalendarEntryDto[]> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        timezone: true,
        preferences: { select: { watchRegion: true } },
      },
    });
    const watchRegion = user.preferences?.watchRegion ?? null;
    const now = new Date();
    const today = localDayOrUtc(user.timezone, now);
    const startOfToday = startOfLocalDay(user.timezone, now);

    const episodes = await this.prisma.episode.findMany({
      where: {
        airDate: {
          gte: startOfToday,
          lt: addDays(startOfToday, EPISODE_WINDOW_DAYS),
        },
        season: {
          mediaItem: {
            entries: { some: { userId, status: { not: "DROPPED" } } },
          },
        },
      },
      // Episodes sharing an air date (a binge drop) need a total order, or
      // Postgres returns them in any order: group by show, then S/E ascending.
      orderBy: [
        { airDate: "asc" },
        { season: { mediaItemId: "asc" } },
        { season: { number: "asc" } },
        { number: "asc" },
      ],
      take: MAX_EPISODES,
      include: {
        season: {
          include: {
            mediaItem: {
              include: {
                externalIds: true,
                // Unique per (userId, mediaItemId), and guaranteed to exist
                // by the `where` above — this is the user's tracked entry.
                entries: {
                  where: { userId },
                  select: { id: true, episodeAlertsMuted: true },
                },
              },
            },
          },
        },
      },
    });

    const behind = await this.episodesBehind(
      userId,
      [...new Set(episodes.map((e) => e.season.mediaItemId))],
      startOfToday,
    );

    const episodeEntries: CalendarEntryDto[] = episodes.map((episode) => ({
      mediaItem: toMediaItemDto(episode.season.mediaItem),
      game: null,
      entryId: episode.season.mediaItem.entries[0].id,
      episodeAlertsMuted:
        episode.season.mediaItem.entries[0].episodeAlertsMuted,
      episodesBehind: behind.get(episode.season.mediaItemId) ?? 0,
      seasonNumber: episode.season.number,
      episodeNumber: episode.number,
      episodeTitle: episode.title,
      ...(episode.episodeType === "finale" ? { seasonFinale: true } : {}),
      // airDate is guaranteed non-null by the `gte` filter above.
      airDate: episode.airDate!.toISOString(),
    }));
    const movies = await this.moviesStillToRelease(userId, today);
    const gameEntries = await this.calendarGames(userId, today);
    const movieEntries: CalendarEntryDto[] = movies.flatMap((entry) => {
      const region = resolveWatchRegion(
        watchRegion ?? entry.movieReleaseRegion ?? undefined,
        acceptLanguage,
      );
      const release = movieReleaseInfo(
        movieReleaseDates(entry.mediaItem.movieReleaseDates),
        entry.mediaItem.status,
        region,
      );
      if (!release.localDate || release.localDate < today || !release.localType)
        return [];
      return [
        {
          mediaItem: toMediaItemDto(entry.mediaItem),
          game: null,
          entryId: entry.id,
          episodeAlertsMuted: !entry.movieReleaseReminderAt,
          episodesBehind: 0,
          seasonNumber: null,
          episodeNumber: null,
          episodeTitle: null,
          airDate: `${release.localDate}T00:00:00.000Z`,
          releaseRegion: region,
          releaseType: release.localType,
        },
      ];
    });
    return [...episodeEntries, ...movieEntries, ...gameEntries].sort((a, b) =>
      a.airDate.localeCompare(b.airDate),
    );
  }

  /**
   * The tracked films with a cinema or digital release on or after `today`
   * in some country: a superset of those the calendar lists, since a film's
   * local date is the earliest of its region's. Filtered in SQL, so the
   * release dates of a whole film library aren't loaded on every call.
   */
  private async moviesStillToRelease(userId: string, today: string) {
    const candidates = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT e.id
      FROM "MediaEntry" e
      JOIN "MediaItem" m ON m.id = e."mediaItemId"
      WHERE e."userId" = ${userId}
        AND e.status <> 'DROPPED'
        AND m.type = 'MOVIE'
        AND EXISTS (
          -- Postgres doesn't promise to test the type before expanding.
          SELECT 1 FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(m."movieReleaseDates") = 'array'
              THEN m."movieReleaseDates" ELSE '[]'::jsonb END
          ) r
          WHERE r->>'date' >= ${today} AND r->>'type' IN ('2', '3', '4')
        )
    `;
    if (candidates.length === 0) return [];

    return this.prisma.mediaEntry.findMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      include: { mediaItem: { include: { externalIds: true } } },
    });
  }

  /**
   * Upcoming releases of the games the user tracks, when their day is known —
   * or their month, on its 1st. A vaguer date has no day to sit on.
   */
  private async calendarGames(
    userId: string,
    today: string,
  ): Promise<CalendarEntryDto[]> {
    const entries = await this.prisma.gameEntry.findMany({
      where: {
        userId,
        status: { not: "DROPPED" },
        user: { enabledDomains: { has: "GAMES" } },
        gameItem: {
          releaseDatePrecision: { in: ["DAY", "MONTH"] },
          releaseDate: { gte: new Date(`${today}T00:00:00.000Z`) },
        },
      },
      include: { gameItem: { include: { externalIds: true } } },
    });
    return entries.map((entry) => ({
      mediaItem: null,
      game: toGameItemDto(entry.gameItem),
      entryId: entry.id,
      episodeAlertsMuted: !entry.releaseReminderAt,
      episodesBehind: 0,
      seasonNumber: null,
      episodeNumber: null,
      episodeTitle: null,
      releasePrecision:
        entry.gameItem.releaseDatePrecision === "MONTH" ? "MONTH" : "DAY",
      // Non-null: guaranteed by the `gte` filter above.
      airDate: entry.gameItem.releaseDate!.toISOString(),
    }));
  }

  /**
   * Per media: regular episodes aired before `before` (or undated — AniList's
   * generated ones, available like in `computeProgress`) the user never
   * watched. Media with no backlog are absent from the map.
   */
  private async episodesBehind(
    userId: string,
    mediaItemIds: string[],
    before: Date,
  ): Promise<Map<string, number>> {
    if (mediaItemIds.length === 0) return new Map();

    const rows = await this.prisma.$queryRaw<
      { mediaItemId: string; behind: bigint }[]
    >`
      SELECT s."mediaItemId", COUNT(*) AS behind
      FROM "Season" s
      JOIN "Episode" e ON e."seasonId" = s.id
      WHERE s."mediaItemId" = ANY(${mediaItemIds})
        AND s.number > 0
        AND (e."airDate" IS NULL OR e."airDate" < ${before})
        AND NOT EXISTS (
          SELECT 1 FROM "EpisodeWatch" w
          WHERE w."episodeId" = e.id AND w."userId" = ${userId}
        )
      GROUP BY s."mediaItemId"
    `;
    return new Map(rows.map((r) => [r.mediaItemId, Number(r.behind)]));
  }
}
