import {
  type CalendarEntryDto,
  Domain,
  ErrorCode,
  type HomeScreenWidgetAddedDto,
  type HomeScreenWidgetFeedDto,
  type HomeScreenWidgetPart,
  type HomeScreenWidgetProgressionDto,
  type HomeScreenWidgetReleaseDto,
  type HomeScreenWidgetSessionDto,
  type HomeScreenWidgetShowDto,
  type HomeScreenWidgetStartTimerDto,
  type HomeScreenWidgetTimerDto,
  type HomeScreenWidgetWatchNextDto,
  levelProgress,
  type LibraryEntryDto,
  type SessionDomain,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { AppException } from "../common/app.exception";
import { canonicalExternalId } from "../common/external-id.util";
import { localDay, localDayOrUtc } from "../common/local-day.util";
import { parsePageQuery } from "../common/pagination.util";
import { XpHistoryService } from "../gamification/xp-history.service";
import { XpService } from "../gamification/xp.service";
import { LibraryService } from "../library/library.service";
import { PrismaService } from "../prisma/prisma.service";
import { SessionTimerService } from "../session-timer/session-timer.service";
import { activityDates } from "../stats/activity-dates";
import {
  computeStreak,
  isStreakSecuredToday,
} from "../stats/video-temporal.util";
import { DomainGateService } from "../users/domain-gate.service";
import { isSuspended } from "../users/suspension.util";
import { signWidgetToken, verifyWidgetToken } from "./widget-token";

/** The most a 5 × 5 widget shows: 3 × 3 posters. */
const FEED_LENGTH = 9;
/** Shows read to find FEED_LENGTH with an episode left to watch. */
const SHOWS_SCANNED = 50;
/** Sessions read to find FEED_LENGTH distinct games and books. */
const SESSIONS_SCANNED = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

const mediaPath = (item: { type: string; sourceId: string }) =>
  `/app/media/${item.type.toLowerCase()}/${item.sourceId}`;

type Work = { title: string; posterUrl: string | null; path: string };
type ItemWithIds = {
  title: string;
  canonicalSource: string;
  externalIds: { source: string; externalId: string }[];
};

const gameWork = (item: ItemWithIds & { coverUrl: string | null }): Work => ({
  title: item.title,
  posterUrl: item.coverUrl,
  path: `/app/games/${canonicalExternalId(item, item.externalIds)}`,
});

const bookWork = (item: ItemWithIds & { coverUrl: string | null }): Work => ({
  title: item.title,
  posterUrl: item.coverUrl,
  path: `/app/books/${canonicalExternalId(item, item.externalIds)}`,
});

const ENTRY_ITEM = { include: { externalIds: true } } as const;

/**
 * What the Android app's home-screen widgets (MOB-20) read and do, outside
 * the WebView: « À suivre » and its button that marks the next episode
 * watched, « Sorties », « Chrono » and its session timer, « Série et
 * niveau », and the latest additions under « Recherche ».
 */
@Injectable()
export class HomeScreenWidgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly library: LibraryService,
    private readonly domains: DomainGateService,
    private readonly timers: SessionTimerService,
    private readonly xp: XpService,
    private readonly xpHistory: XpHistoryService,
  ) {}

  token(userId: string, sessionId: string | undefined): { token: string } {
    // Only a browser session can hand its widgets a token: an API key has none.
    if (!sessionId) throw tokenInvalid(HttpStatus.FORBIDDEN);
    return { token: signWidgetToken({ userId, sessionId }) };
  }

  /** The account a widget acts for, while the session that gave it its token lasts. */
  async authenticate(token: string | undefined): Promise<string> {
    const claims = verifyWidgetToken(token ?? "");
    if (!claims) throw tokenInvalid(HttpStatus.UNAUTHORIZED);

    const session = await this.prisma.refreshToken.findFirst({
      where: {
        id: claims.sessionId,
        userId: claims.userId,
        expiresAt: { gt: new Date() },
      },
      select: { user: { select: { suspendedUntil: true } } },
    });

    if (!session || isSuspended(session.user)) {
      throw tokenInvalid(HttpStatus.UNAUTHORIZED);
    }

    return claims.userId;
  }

  /** Only the parts the placed widgets read: the rest stays empty. */
  async feed(
    userId: string,
    parts: ReadonlySet<HomeScreenWidgetPart>,
    lang?: string,
    acceptLanguage?: string,
  ): Promise<HomeScreenWidgetFeedDto> {
    const enabled = new Set(await this.domains.getEnabledDomains(userId));
    const [toWatch, releases, chrono, progression, added] = await Promise.all([
      parts.has("toWatch") && enabled.has(Domain.MEDIA)
        ? this.toWatch(userId, lang)
        : [],
      parts.has("releases")
        ? this.library
            .getCalendar(userId, acceptLanguage)
            .then((calendar) => calendar.slice(0, FEED_LENGTH).map(toRelease))
        : [],
      parts.has("timer") ? this.chrono(userId, enabled) : null,
      parts.has("progression") ? this.progression(userId) : null,
      parts.has("added") ? this.added(userId, enabled) : [],
    ]);
    return {
      toWatch,
      releases,
      timer: chrono?.timer ?? null,
      sessions: chrono?.sessions ?? [],
      weekMinutes: chrono?.weekMinutes ?? 0,
      progression,
      added,
    };
  }

  /**
   * Marks the episode the widget showed watched, if it's still the show's
   * next one: a widget drawn before the episode was watched elsewhere must
   * not log it twice.
   */
  async watchNext(
    userId: string,
    dto: HomeScreenWidgetWatchNextDto,
  ): Promise<void> {
    const entry = await this.library.getEntry(userId, dto.entryId);
    if (entry.progress?.nextEpisode?.episodeId !== dto.episodeId) return;
    await this.library.watchEpisode(userId, dto.episodeId, {});
  }

  startTimer(userId: string, dto: HomeScreenWidgetStartTimerDto) {
    return this.timers.start(userId, dto);
  }

  pauseTimer(userId: string) {
    return this.timers.pause(userId);
  }

  resumeTimer(userId: string) {
    return this.timers.resume(userId);
  }

  /** Saves the session as it stands: a book's pages are filled in from the app. */
  finishTimer(userId: string) {
    return this.timers.finish(userId, {});
  }

  private async toWatch(
    userId: string,
    lang?: string,
  ): Promise<HomeScreenWidgetShowDto[]> {
    const { items } = await this.library.listEntries(userId, {
      statuses: ["WATCHING"],
      types: ["SERIES", "ANIME"],
      page: 1,
      limit: SHOWS_SCANNED,
      lang,
    });
    return items
      .filter((entry) => entry.progress?.nextEpisode)
      .sort((a, b) => lastActivity(b) - lastActivity(a))
      .slice(0, FEED_LENGTH)
      .map((entry) => ({
        entryId: entry.id,
        title: entry.mediaItem.title,
        posterUrl: entry.mediaItem.posterUrl,
        path: mediaPath(entry.mediaItem),
        next: entry.progress!.nextEpisode!,
        watchedEpisodes: entry.progress!.watchedEpisodes,
        totalEpisodes: entry.progress!.totalEpisodes,
      }));
  }

  /** The running timer, the games and books it can start again, and the week's total. */
  private async chrono(userId: string, enabled: ReadonlySet<string>) {
    const games = enabled.has(Domain.GAMES);
    const books = enabled.has(Domain.BOOKS);
    const weekStart = new Date(Date.now() - 7 * DAY_MS);

    const [current, gameSessions, bookSessions, gameWeek, bookWeek] =
      await Promise.all([
        this.timers.current(userId),
        games
          ? this.prisma.gameSession.findMany({
              where: { gameEntry: { userId } },
              orderBy: { occurredAt: "desc" },
              take: SESSIONS_SCANNED,
              include: { gameEntry: { include: { gameItem: ENTRY_ITEM } } },
            })
          : [],
        books
          ? this.prisma.bookSession.findMany({
              where: { bookEntry: { userId } },
              orderBy: { occurredAt: "desc" },
              take: SESSIONS_SCANNED,
              include: { bookEntry: { include: { bookItem: ENTRY_ITEM } } },
            })
          : [],
        games
          ? this.prisma.gameSession.aggregate({
              where: { gameEntry: { userId }, occurredAt: { gte: weekStart } },
              _sum: { durationMinutes: true },
            })
          : null,
        books
          ? this.prisma.bookSession.aggregate({
              where: { bookEntry: { userId }, occurredAt: { gte: weekStart } },
              _sum: { durationMinutes: true },
            })
          : null,
      ]);

    const sessions: HomeScreenWidgetSessionDto[] = [
      ...gameSessions.map((session) => ({
        domain: Domain.GAMES as SessionDomain,
        entryId: session.gameEntryId,
        ...gameWork(session.gameEntry.gameItem),
        durationMinutes: session.durationMinutes,
        occurredAt: session.occurredAt.toISOString(),
      })),
      ...bookSessions.map((session) => ({
        domain: Domain.BOOKS as SessionDomain,
        entryId: session.bookEntryId,
        ...bookWork(session.bookEntry.bookItem),
        durationMinutes: session.durationMinutes,
        occurredAt: session.occurredAt.toISOString(),
      })),
    ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    const seen = new Set(current ? [current.entryId] : []);
    const latest = sessions.filter((session) => {
      if (seen.has(session.entryId)) return false;
      seen.add(session.entryId);
      return true;
    });

    return {
      timer: current ? await this.timerWork(current) : null,
      sessions: latest.slice(0, FEED_LENGTH),
      weekMinutes:
        (gameWeek?._sum.durationMinutes ?? 0) +
        (bookWeek?._sum.durationMinutes ?? 0),
    };
  }

  private async timerWork(timer: {
    domain: SessionDomain;
    entryId: string;
    elapsedSeconds: number;
    pausedAt: string | null;
  }): Promise<HomeScreenWidgetTimerDto | null> {
    const work =
      timer.domain === Domain.GAMES
        ? await this.prisma.gameEntry
            .findUnique({
              where: { id: timer.entryId },
              include: { gameItem: ENTRY_ITEM },
            })
            .then((entry) => entry && gameWork(entry.gameItem))
        : await this.prisma.bookEntry
            .findUnique({
              where: { id: timer.entryId },
              include: { bookItem: ENTRY_ITEM },
            })
            .then((entry) => entry && bookWork(entry.bookItem));
    if (!work) return null;

    return {
      domain: timer.domain,
      entryId: timer.entryId,
      ...work,
      elapsedSeconds: timer.elapsedSeconds,
      paused: timer.pausedAt !== null,
    };
  }

  /** Level, streak and the week's active days, in the account's own time zone. */
  private async progression(
    userId: string,
  ): Promise<HomeScreenWidgetProgressionDto | null> {
    const xp = await this.xp.myXp(userId);
    if (xp === null) return null;

    const now = new Date();
    const [dates, user, history] = await Promise.all([
      activityDates(this.prisma, userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      }),
      this.xpHistory.history(userId, parsePageQuery(undefined, "3", 3)),
    ]);
    // User.timezone is unvalidated (see local-day.util.ts): an invalid one
    // falls back to UTC, like everywhere else.
    const timezone =
      user && localDay(user.timezone, now) ? user.timezone : "UTC";
    const week = new Set(
      Array.from({ length: 7 }, (_, i) =>
        localDayOrUtc(timezone, new Date(now.getTime() - i * DAY_MS)),
      ),
    );
    const activeDays = [
      ...new Set(dates.map((date) => localDayOrUtc(timezone, date))),
    ]
      .filter((day) => week.has(day))
      .sort();

    return {
      xp,
      ...levelProgress(xp),
      streakDays: computeStreak(dates, now),
      streakSecuredToday: isStreakSecuredToday(dates, now),
      today: localDayOrUtc(timezone, now),
      activeDays,
      gains: history.items
        .flatMap((day) => day.items)
        .filter((item) => !item.revoked && item.amount > 0)
        .slice(0, FEED_LENGTH)
        .map((item) => ({
          amount: item.amount,
          title: item.title,
          at: item.at,
        })),
    };
  }

  /** The latest works added to the library, every domain together. */
  private async added(
    userId: string,
    enabled: ReadonlySet<string>,
  ): Promise<HomeScreenWidgetAddedDto[]> {
    const latest = {
      orderBy: { createdAt: "desc" as const },
      take: FEED_LENGTH,
    };
    const [media, games, books, albums] = await Promise.all([
      enabled.has(Domain.MEDIA)
        ? this.prisma.libraryEntry.findMany({
            where: { userId },
            ...latest,
            include: { mediaItem: ENTRY_ITEM },
          })
        : [],
      enabled.has(Domain.GAMES)
        ? this.prisma.gameEntry.findMany({
            where: { userId },
            ...latest,
            include: { gameItem: ENTRY_ITEM },
          })
        : [],
      enabled.has(Domain.BOOKS)
        ? this.prisma.bookEntry.findMany({
            where: { userId },
            ...latest,
            include: { bookItem: ENTRY_ITEM },
          })
        : [],
      enabled.has(Domain.MUSIC)
        ? this.prisma.musicEntry.findMany({
            where: { userId },
            ...latest,
            include: { musicItem: ENTRY_ITEM },
          })
        : [],
    ]);

    return [
      ...media.map((entry) => ({
        kind: entry.mediaItem.type,
        title: entry.mediaItem.title,
        posterUrl: entry.mediaItem.posterUrl,
        path: mediaPath({
          type: entry.mediaItem.type,
          sourceId: canonicalExternalId(
            entry.mediaItem,
            entry.mediaItem.externalIds,
          ),
        }),
        addedAt: entry.createdAt.toISOString(),
      })),
      ...games.map((entry) => ({
        kind: "GAME" as const,
        ...gameWork(entry.gameItem),
        addedAt: entry.createdAt.toISOString(),
      })),
      ...books.map((entry) => ({
        kind: "BOOK" as const,
        ...bookWork(entry.bookItem),
        addedAt: entry.createdAt.toISOString(),
      })),
      ...albums.map((entry) => ({
        kind: "ALBUM" as const,
        title: entry.musicItem.title,
        posterUrl: entry.musicItem.coverUrl,
        path: `/app/music/${canonicalExternalId(entry.musicItem, entry.musicItem.externalIds)}`,
        addedAt: entry.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
      .slice(0, FEED_LENGTH);
  }
}

const lastActivity = (entry: LibraryEntryDto) =>
  new Date(entry.lastWatchedAt ?? entry.updatedAt).getTime();

function toRelease(entry: CalendarEntryDto): HomeScreenWidgetReleaseDto {
  const common = {
    seasonNumber: entry.seasonNumber,
    episodeNumber: entry.episodeNumber,
    airDate: entry.airDate,
    releasePrecision: entry.releasePrecision,
  };

  if (entry.game) {
    return {
      ...common,
      kind: "GAME",
      title: entry.game.title,
      posterUrl: entry.game.coverUrl,
      path: `/app/games/${entry.game.sourceId}`,
    };
  }

  const item = entry.mediaItem!;
  return {
    ...common,
    kind: item.type === "MOVIE" ? "MOVIE" : "EPISODE",
    title: item.title,
    posterUrl: item.posterUrl,
    path: mediaPath(item),
  };
}

const tokenInvalid = (status: HttpStatus) =>
  new AppException(status, ErrorCode.HomeScreenWidgetTokenInvalid);
