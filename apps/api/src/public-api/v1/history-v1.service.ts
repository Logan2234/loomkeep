import type {
  ApiV1HistoryEventDto,
  ApiV1HistoryEventType,
  ApiV1WorkDto,
  Locale,
  PagedResult,
  StatsDomain,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import { canonicalExternalId } from "../../common/external-id.util";
import { ValidationException } from "../../common/validation.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { LibraryV1Service, webOriginOf } from "./library-v1.service";
import { albumWork, bookWork, gameWork, mediaWork } from "./mappers";
import { WorkTitlesService } from "./work-titles.service";

export interface HistoryV1Query {
  range: DateRange;
  domain?: StatsDomain;
  page: number;
  limit: number;
  lang?: Locale;
}

interface Page {
  page: number;
  limit: number;
}

export interface DateRange {
  gte?: Date;
  lt?: Date;
}

/**
 * Either every dated event in a window, across the account, or every event
 * of one library entry — undated ones included, since that entry's own
 * history is where an imported, undated viewing still belongs.
 */
type Scope =
  | { userId: string; range: DateRange; entryId?: undefined }
  | { userId: string; entryId: string; range?: undefined };

interface HistorySource {
  count(scope: Scope): Promise<number>;
  /** Newest first, undated last; `take` caps it for a window merge. */
  find(scope: Scope, take?: number): Promise<ApiV1HistoryEventDto[]>;
}

const EXTERNAL_IDS = { select: { source: true, externalId: true } } as const;

const MEDIA_ITEM = {
  select: {
    id: true,
    type: true,
    title: true,
    posterUrl: true,
    canonicalSource: true,
    runtimeMin: true,
    externalIds: EXTERNAL_IDS,
  },
} as const;
const GAME_ITEM = {
  select: {
    id: true,
    title: true,
    coverUrl: true,
    canonicalSource: true,
    externalIds: EXTERNAL_IDS,
  },
} as const;
const BOOK_ITEM = {
  select: {
    id: true,
    title: true,
    authors: true,
    coverUrl: true,
    canonicalSource: true,
    externalIds: EXTERNAL_IDS,
  },
} as const;
const MUSIC_ITEM = {
  select: {
    id: true,
    title: true,
    artists: true,
    coverUrl: true,
    canonicalSource: true,
    durationMin: true,
    externalIds: EXTERNAL_IDS,
  },
} as const;

/**
 * The account's consumption history: episodes and films seen, game and
 * reading sessions, finished playthroughs, readings and albums. Each kind
 * lives in its own table, so a window is read from every one of them and
 * merged — the same approach as the cross-domain library list.
 */
@Injectable()
export class HistoryV1Service {
  private readonly webOrigin: string;
  private readonly sources: Record<StatsDomain, HistorySource[]>;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly library: LibraryV1Service,
    private readonly titles: WorkTitlesService,
  ) {
    this.webOrigin = webOriginOf(config);
    this.sources = {
      MEDIA: [this.episodes(), this.firstViewings(), this.movieRewatches()],
      GAMES: [this.gameSessions(), this.playthroughs()],
      BOOKS: [this.readingSessions(), this.readings()],
      MUSIC: [this.albums()],
    };
  }

  async list(
    userId: string,
    query: HistoryV1Query,
  ): Promise<PagedResult<ApiV1HistoryEventDto>> {
    const domains = await this.library.domainsFor(userId, query.domain);
    const scope: Scope = {
      userId,
      range: query.range,
    };
    const sources = domains.flatMap((domain) => this.sources[domain]);
    const window = query.page * query.limit;

    const [counts, pages] = await Promise.all([
      Promise.all(sources.map((source) => source.count(scope))),
      Promise.all(sources.map((source) => source.find(scope, window))),
    ]);
    const total = counts.reduce((sum, count) => sum + count, 0);
    const offset = (query.page - 1) * query.limit;
    const items = pages
      .flat()
      .sort(newestFirst)
      .slice(offset, offset + query.limit);

    await this.translate(userId, query.lang, items);
    return { items, total, hasMore: offset + query.limit < total };
  }

  async forEntry(
    userId: string,
    entryId: string,
    query: Page & { lang?: Locale },
  ): Promise<PagedResult<ApiV1HistoryEventDto>> {
    const domain = await this.library.entryDomain(userId, entryId);
    const scope: Scope = { userId, entryId };
    const events = (
      await Promise.all(
        this.sources[domain].map((source) => source.find(scope)),
      )
    )
      .flat()
      .sort(newestFirst);

    const offset = (query.page - 1) * query.limit;
    const items = events.slice(offset, offset + query.limit);
    await this.translate(userId, query.lang, items);
    return {
      items,
      total: events.length,
      hasMore: offset + query.limit < events.length,
    };
  }

  private async translate(
    userId: string,
    lang: Locale | undefined,
    events: ApiV1HistoryEventDto[],
  ): Promise<void> {
    await this.titles.translateWorks(
      await this.titles.languageFor(userId, lang),
      events.map((event) => event.work),
    );
  }

  private episodes(): HistorySource {
    const where = (scope: Scope): Prisma.EpisodeWatchWhereInput => ({
      userId: scope.userId,
      watchedAt: datedIn(scope),
      episode: {
        season: {
          mediaItem: {
            entries: {
              some: { userId: scope.userId, id: scope.entryId },
            },
          },
        },
      },
    });

    return {
      count: (scope) => this.prisma.episodeWatch.count({ where: where(scope) }),
      find: async (scope, take) => {
        const watches = await this.prisma.episodeWatch.findMany({
          where: where(scope),
          orderBy: [
            { watchedAt: { sort: "desc", nulls: "last" } },
            { id: "desc" },
          ],
          take,
          select: {
            id: true,
            watchedAt: true,
            episode: {
              select: {
                number: true,
                title: true,
                runtimeMin: true,
                season: {
                  select: {
                    number: true,
                    mediaItem: {
                      select: {
                        ...MEDIA_ITEM.select,
                        entries: {
                          where: { userId: scope.userId },
                          select: { id: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        return watches.map(({ id, watchedAt, episode }) => {
          const media = episode.season.mediaItem;
          return this.event("EPISODE_WATCHED", {
            id,
            date: watchedAt,
            entryId: media.entries[0].id,
            work: this.mediaWorkOf(media),
            episode: {
              seasonNumber: episode.season.number,
              episodeNumber: episode.number,
              title: episode.title,
            },
            durationMinutes: episode.runtimeMin ?? media.runtimeMin,
          });
        });
      },
    };
  }

  /** A film's first viewing is its completed library entry itself. */
  private firstViewings(): HistorySource {
    const where = (scope: Scope): Prisma.LibraryEntryWhereInput => ({
      id: scope.entryId,
      userId: scope.userId,
      status: "COMPLETED",
      mediaItem: { type: "MOVIE" },
      finishedAt: datedIn(scope),
    });

    return {
      count: (scope) => this.prisma.libraryEntry.count({ where: where(scope) }),
      find: async (scope, take) => {
        const entries = await this.prisma.libraryEntry.findMany({
          where: where(scope),
          orderBy: [
            { finishedAt: { sort: "desc", nulls: "last" } },
            { id: "desc" },
          ],
          take,
          select: { id: true, finishedAt: true, mediaItem: MEDIA_ITEM },
        });

        return entries.map((entry) =>
          this.event("MOVIE_WATCHED", {
            id: entry.id,
            date: entry.finishedAt,
            entryId: entry.id,
            work: this.mediaWorkOf(entry.mediaItem),
            cycle: 1,
            durationMinutes: entry.mediaItem.runtimeMin,
          }),
        );
      },
    };
  }

  /** Rewatches come after the first viewing, in the order they happened. */
  private movieRewatches(): HistorySource {
    const where = (scope: Scope): Prisma.MovieReplayWhereInput => ({
      libraryEntryId: scope.entryId,
      libraryEntry: { userId: scope.userId },
      finishedAt: scope.range && { gte: scope.range.gte, lt: scope.range.lt },
    });

    return {
      count: (scope) => this.prisma.movieReplay.count({ where: where(scope) }),
      find: async (scope, take) => {
        const replays = await this.prisma.movieReplay.findMany({
          where: where(scope),
          orderBy: [{ finishedAt: "desc" }, { id: "desc" }],
          take,
          select: {
            id: true,
            finishedAt: true,
            libraryEntryId: true,
            libraryEntry: { select: { mediaItem: MEDIA_ITEM } },
          },
        });
        const order = await this.prisma.movieReplay.findMany({
          where: {
            libraryEntryId: {
              in: [...new Set(replays.map((r) => r.libraryEntryId))],
            },
          },
          orderBy: [{ finishedAt: "asc" }, { id: "asc" }],
          select: { id: true, libraryEntryId: true },
        });
        const rank = new Map<string, number>();
        const seen = new Map<string, number>();

        for (const { id, libraryEntryId } of order) {
          const n = (seen.get(libraryEntryId) ?? 0) + 1;
          seen.set(libraryEntryId, n);
          rank.set(id, n);
        }

        return replays.map((replay) => {
          const media = replay.libraryEntry.mediaItem;
          return this.event("MOVIE_WATCHED", {
            id: replay.id,
            date: replay.finishedAt,
            entryId: replay.libraryEntryId,
            work: this.mediaWorkOf(media),
            cycle: (rank.get(replay.id) ?? 0) + 1,
            durationMinutes: media.runtimeMin,
          });
        });
      },
    };
  }

  private gameSessions(): HistorySource {
    const where = (scope: Scope): Prisma.GameSessionWhereInput => ({
      gameEntryId: scope.entryId,
      gameEntry: { userId: scope.userId },
      occurredAt: scope.range && { gte: scope.range.gte, lt: scope.range.lt },
    });

    return {
      count: (scope) => this.prisma.gameSession.count({ where: where(scope) }),
      find: async (scope, take) => {
        const sessions = await this.prisma.gameSession.findMany({
          where: where(scope),
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          take,
          select: {
            id: true,
            occurredAt: true,
            durationMinutes: true,
            notes: true,
            gameEntryId: true,
            playthrough: { select: { number: true } },
            gameEntry: { select: { gameItem: GAME_ITEM } },
          },
        });

        return sessions.map((session) =>
          this.event("GAME_SESSION", {
            id: session.id,
            date: session.occurredAt,
            entryId: session.gameEntryId,
            work: gameWork(
              withSourceId(session.gameEntry.gameItem),
              this.webOrigin,
            ),
            cycle: session.playthrough?.number ?? null,
            durationMinutes: session.durationMinutes,
            notes: session.notes,
          }),
        );
      },
    };
  }

  private playthroughs(): HistorySource {
    const where = (scope: Scope): Prisma.GamePlaythroughWhereInput => ({
      gameEntryId: scope.entryId,
      gameEntry: { userId: scope.userId },
      status: "COMPLETED",
      finishedAt: datedIn(scope),
    });

    return {
      count: (scope) =>
        this.prisma.gamePlaythrough.count({ where: where(scope) }),
      find: async (scope, take) => {
        const playthroughs = await this.prisma.gamePlaythrough.findMany({
          where: where(scope),
          orderBy: [
            { finishedAt: { sort: "desc", nulls: "last" } },
            { id: "desc" },
          ],
          take,
          select: {
            id: true,
            number: true,
            finishedAt: true,
            gameEntryId: true,
            gameEntry: { select: { gameItem: GAME_ITEM } },
          },
        });

        return playthroughs.map((playthrough) =>
          this.event("GAME_COMPLETED", {
            id: playthrough.id,
            date: playthrough.finishedAt,
            entryId: playthrough.gameEntryId,
            work: gameWork(
              withSourceId(playthrough.gameEntry.gameItem),
              this.webOrigin,
            ),
            cycle: playthrough.number,
          }),
        );
      },
    };
  }

  private readingSessions(): HistorySource {
    const where = (scope: Scope): Prisma.BookSessionWhereInput => ({
      bookEntryId: scope.entryId,
      bookEntry: { userId: scope.userId },
      occurredAt: scope.range && { gte: scope.range.gte, lt: scope.range.lt },
    });

    return {
      count: (scope) => this.prisma.bookSession.count({ where: where(scope) }),
      find: async (scope, take) => {
        const sessions = await this.prisma.bookSession.findMany({
          where: where(scope),
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          take,
          select: {
            id: true,
            occurredAt: true,
            durationMinutes: true,
            pagesRead: true,
            startPage: true,
            endPage: true,
            notes: true,
            bookEntryId: true,
            reading: { select: { number: true } },
            bookEntry: { select: { bookItem: BOOK_ITEM } },
          },
        });

        return sessions.map((session) =>
          this.event("BOOK_SESSION", {
            id: session.id,
            date: session.occurredAt,
            entryId: session.bookEntryId,
            work: bookWork(
              withSourceId(session.bookEntry.bookItem),
              this.webOrigin,
            ),
            cycle: session.reading?.number ?? null,
            durationMinutes: session.durationMinutes,
            pages: {
              read: session.pagesRead,
              from: session.startPage,
              to: session.endPage,
            },
            notes: session.notes,
          }),
        );
      },
    };
  }

  private readings(): HistorySource {
    const where = (scope: Scope): Prisma.BookReadingWhereInput => ({
      bookEntryId: scope.entryId,
      bookEntry: { userId: scope.userId },
      status: "COMPLETED",
      finishedAt: datedIn(scope),
    });

    return {
      count: (scope) => this.prisma.bookReading.count({ where: where(scope) }),
      find: async (scope, take) => {
        const readings = await this.prisma.bookReading.findMany({
          where: where(scope),
          orderBy: [
            { finishedAt: { sort: "desc", nulls: "last" } },
            { id: "desc" },
          ],
          take,
          select: {
            id: true,
            number: true,
            finishedAt: true,
            bookEntryId: true,
            bookEntry: { select: { bookItem: BOOK_ITEM } },
          },
        });

        return readings.map((reading) =>
          this.event("BOOK_FINISHED", {
            id: reading.id,
            date: reading.finishedAt,
            entryId: reading.bookEntryId,
            work: bookWork(
              withSourceId(reading.bookEntry.bookItem),
              this.webOrigin,
            ),
            cycle: reading.number,
          }),
        );
      },
    };
  }

  /** Music has no replays: an album is listened once, when marked so. */
  private albums(): HistorySource {
    const where = (scope: Scope): Prisma.MusicEntryWhereInput => ({
      id: scope.entryId,
      userId: scope.userId,
      status: "LISTENED",
      finishedAt: datedIn(scope),
    });

    return {
      count: (scope) => this.prisma.musicEntry.count({ where: where(scope) }),
      find: async (scope, take) => {
        const entries = await this.prisma.musicEntry.findMany({
          where: where(scope),
          orderBy: [
            { finishedAt: { sort: "desc", nulls: "last" } },
            { id: "desc" },
          ],
          take,
          select: { id: true, finishedAt: true, musicItem: MUSIC_ITEM },
        });

        return entries.map((entry) =>
          this.event("ALBUM_LISTENED", {
            id: entry.id,
            date: entry.finishedAt,
            entryId: entry.id,
            work: albumWork(withSourceId(entry.musicItem), this.webOrigin),
            durationMinutes: entry.musicItem.durationMin,
          }),
        );
      },
    };
  }

  private mediaWorkOf(
    media: Prisma.MediaItemGetPayload<typeof MEDIA_ITEM>,
  ): ApiV1WorkDto {
    return mediaWork(withSourceId(media), this.webOrigin);
  }

  private event(
    type: ApiV1HistoryEventType,
    fields: Pick<ApiV1HistoryEventDto, "id" | "entryId" | "work"> &
      Partial<
        Pick<
          ApiV1HistoryEventDto,
          "episode" | "cycle" | "durationMinutes" | "pages" | "notes"
        >
      > & { date: Date | null },
  ): ApiV1HistoryEventDto {
    return {
      id: fields.id,
      type,
      date: fields.date?.toISOString() ?? null,
      entryId: fields.entryId,
      work: fields.work,
      episode: fields.episode ?? null,
      cycle: fields.cycle ?? null,
      durationMinutes: fields.durationMinutes ?? null,
      pages: fields.pages ?? null,
      notes: fields.notes ?? null,
    };
  }
}

/** Over a window, only dated events; for one entry, all of them. */
function datedIn(scope: Scope): Prisma.DateTimeNullableFilter | undefined {
  return scope.range && { not: null, gte: scope.range.gte, lt: scope.range.lt };
}

function withSourceId<
  T extends {
    canonicalSource: string;
    externalIds: { source: string; externalId: string }[];
  },
>(item: T): T & { sourceId: string } {
  return { ...item, sourceId: canonicalExternalId(item, item.externalIds) };
}

/** Newest first, undated last, then by id so a merge across tables is stable. */
export function newestFirst(
  a: ApiV1HistoryEventDto,
  b: ApiV1HistoryEventDto,
): number {
  if (a.date !== b.date) {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date < b.date ? 1 : -1;
  }

  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * `?from=&to=` as a half-open range. A bare date for `to` means "up to and
 * including that day", which is what someone asking for September means by
 * `to=2026-09-30`.
 */
export function historyRange(from?: string, to?: string): DateRange {
  const gte = from ? new Date(from) : undefined;
  let lt: Date | undefined;

  if (to) {
    lt = new Date(to);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) lt.setUTCDate(lt.getUTCDate() + 1);
  }

  if (gte && lt && gte >= lt) {
    throw new ValidationException([
      { property: "to", constraints: { isAfterFrom: "" }, children: [] },
    ]);
  }

  return { gte, lt };
}
