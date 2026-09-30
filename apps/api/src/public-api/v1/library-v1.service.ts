import type {
  ApiV1CalendarEpisodeDto,
  ApiV1LibraryEntryDto,
  ApiV1LibrarySort,
  ApiV1Phase,
  PagedResult,
  StatsDomain,
} from "@loomkeep/shared";
import {
  BookStatus,
  EntryStatus,
  ErrorCode,
  GameStatus,
  MusicStatus,
  STATS_DOMAINS,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BookLibraryService } from "../../books/book-library.service";
import { AppException } from "../../common/app.exception";
import type { ListEntriesFilters } from "../../common/entry-lifecycle.util";
import { compareTitles, timeMs } from "../../common/sort.util";
import { GameLibraryService } from "../../games/game-library.service";
import { LibraryService } from "../../library/library.service";
import { MusicLibraryService } from "../../music/music-library.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  bucketizeBookStatus,
  bucketizeEntryStatus,
  bucketizeGameStatus,
  bucketizeMusicStatus,
} from "../../stats/status-bucket.util";
import { DomainGateService } from "../../users/domain-gate.service";
import {
  fromBookEntry,
  fromGameEntry,
  fromMediaEntry,
  fromMusicEntry,
  mediaWork,
} from "./mappers";

export interface LibraryV1Query {
  domain?: StatsDomain;
  phases?: ApiV1Phase[];
  favorite?: boolean;
  sort: ApiV1LibrarySort;
  order: "asc" | "desc";
  page: number;
  limit: number;
}

// Each domain's statuses and how they normalise, so a phase filter can be
// turned back into the statuses each domain's own list understands.
const NATIVE_STATUSES: {
  [D in StatsDomain]: { statuses: string[]; phase: (s: string) => ApiV1Phase };
} = {
  MEDIA: {
    statuses: Object.values(EntryStatus),
    phase: (s) => bucketizeEntryStatus(s as EntryStatus),
  },
  GAMES: {
    statuses: Object.values(GameStatus),
    phase: (s) => bucketizeGameStatus(s as GameStatus),
  },
  BOOKS: {
    statuses: Object.values(BookStatus),
    phase: (s) => bucketizeBookStatus(s as BookStatus),
  },
  MUSIC: {
    statuses: Object.values(MusicStatus),
    phase: (s) => bucketizeMusicStatus(s as MusicStatus),
  },
};

@Injectable()
export class LibraryV1Service {
  private readonly webOrigin: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly domainGate: DomainGateService,
    private readonly media: LibraryService,
    private readonly games: GameLibraryService,
    private readonly books: BookLibraryService,
    private readonly music: MusicLibraryService,
  ) {
    this.webOrigin = webOriginOf(config);
  }

  /**
   * One domain pages through that domain's own list. Across domains, each
   * list is read up to the requested page and the results merged with the
   * same ordering rules — deep pages cost more, which is what `/export` is
   * for.
   */
  async list(
    userId: string,
    query: LibraryV1Query,
  ): Promise<PagedResult<ApiV1LibraryEntryDto>> {
    const enabled = await this.enabledDomains(userId);

    if (query.domain && !enabled.includes(query.domain)) {
      await this.domainGate.assertEnabled(userId, query.domain);
    }

    const domains = query.domain ? [query.domain] : enabled;
    const single = domains.length === 1;
    const window = query.page * query.limit;

    const pages = await Promise.all(
      domains.map((domain) => {
        const statuses = statusesFor(domain, query.phases);

        if (statuses?.length === 0) {
          return { items: [], total: 0, hasMore: false };
        }

        return this.listDomain(userId, domain, {
          statuses,
          favorite: query.favorite,
          sort: query.sort,
          order: query.order,
          page: single ? query.page : 1,
          limit: single ? query.limit : window,
        });
      }),
    );

    if (single) return pages[0];

    const total = pages.reduce((sum, page) => sum + (page.total ?? 0), 0);
    const offset = (query.page - 1) * query.limit;
    const merged = pages
      .flatMap((page) => page.items)
      .sort((a, b) => {
        const c = compareEntries(query.sort, a, b);
        return query.order === "asc" ? -c : c;
      });
    return {
      items: merged.slice(offset, offset + query.limit),
      total,
      hasMore: offset + query.limit < total,
    };
  }

  async get(userId: string, id: string): Promise<ApiV1LibraryEntryDto> {
    const where = { id, userId };
    const [media, game, book, album] = await Promise.all([
      this.prisma.libraryEntry.findFirst({ where, select: { id: true } }),
      this.prisma.gameEntry.findFirst({ where, select: { id: true } }),
      this.prisma.bookEntry.findFirst({ where, select: { id: true } }),
      this.prisma.musicEntry.findFirst({ where, select: { id: true } }),
    ]);
    const domain: StatsDomain | null = media
      ? "MEDIA"
      : game
        ? "GAMES"
        : book
          ? "BOOKS"
          : album
            ? "MUSIC"
            : null;

    if (!domain || !(await this.enabledDomains(userId)).includes(domain)) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibraryEntryNotFound,
      );
    }

    switch (domain) {
      case "MEDIA":
        return fromMediaEntry(
          await this.media.getEntry(userId, id),
          this.webOrigin,
        );
      case "GAMES":
        return fromGameEntry(
          await this.games.getEntry(userId, id),
          this.webOrigin,
        );
      case "BOOKS":
        return fromBookEntry(
          await this.books.getEntry(userId, id),
          this.webOrigin,
        );
      case "MUSIC":
        return fromMusicEntry(
          await this.music.getEntry(userId, id),
          this.webOrigin,
        );
    }
  }

  /** Upcoming episodes of the shows being followed, today included. */
  async calendar(
    userId: string,
    days: number,
  ): Promise<ApiV1CalendarEpisodeDto[]> {
    await this.domainGate.assertEnabled(userId, "MEDIA");
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + days);

    const episodes = await this.media.getCalendar(userId);
    return episodes
      .filter((episode) => new Date(episode.airDate) < end)
      .map((episode) => ({
        airDate: episode.airDate,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        episodeTitle: episode.episodeTitle,
        episodesBehind: episode.episodesBehind,
        work: mediaWork(episode.mediaItem, this.webOrigin),
      }));
  }

  private async enabledDomains(userId: string): Promise<StatsDomain[]> {
    const enabled = await this.domainGate.getEnabledDomains(userId);
    return STATS_DOMAINS.filter((domain) => enabled.includes(domain));
  }

  private async listDomain(
    userId: string,
    domain: StatsDomain,
    filters: ListEntriesFilters,
  ): Promise<PagedResult<ApiV1LibraryEntryDto>> {
    const map = <T>(
      page: PagedResult<T>,
      to: (item: T, webOrigin: string) => ApiV1LibraryEntryDto,
    ) => ({
      ...page,
      items: page.items.map((item) => to(item, this.webOrigin)),
    });

    switch (domain) {
      case "MEDIA":
        return map(
          await this.media.listEntries(userId, filters),
          fromMediaEntry,
        );
      case "GAMES":
        return map(
          await this.games.listEntries(userId, filters),
          fromGameEntry,
        );
      case "BOOKS":
        return map(
          await this.books.listEntries(userId, filters),
          fromBookEntry,
        );
      case "MUSIC":
        return map(
          await this.music.listEntries(userId, filters),
          fromMusicEntry,
        );
    }
  }
}

/** Undefined means "no filter"; an empty array means no status of that domain matches. */
export function statusesFor(
  domain: StatsDomain,
  phases: ApiV1Phase[] | undefined,
): string[] | undefined {
  if (!phases?.length) return undefined;
  const { statuses, phase } = NATIVE_STATUSES[domain];
  return statuses.filter((status) => phases.includes(phase(status)));
}

/** Same natural order as each domain's own list, so a merge keeps it. */
export function compareEntries(
  sort: ApiV1LibrarySort,
  a: ApiV1LibraryEntryDto,
  b: ApiV1LibraryEntryDto,
): number {
  switch (sort) {
    case "title":
      return compareTitles(a.work.title, b.work.title);
    case "rating":
      return (b.rating ?? -1) - (a.rating ?? -1);
    case "finished":
      return timeMs(b.finishedAt) - timeMs(a.finishedAt);
    case "added":
      return b.addedAt.localeCompare(a.addedAt);
  }
}

/** WEB_ORIGIN may list several origins; links point at the first. */
export function webOriginOf(config: ConfigService): string {
  return (
    (config.get<string>("WEB_ORIGIN") ?? "")
      .split(",")[0]
      ?.trim()
      .replace(/\/$/, "") || "http://localhost:5173"
  );
}
