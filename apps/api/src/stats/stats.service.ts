import type {
  BookStatsDto,
  DomainStatusBreakdownDto,
  GameStatsDto,
  MusicStatsDto,
  ReviewTargetType,
  SocialStatsDto,
  StatsDomain,
  StatsOverviewDto,
  StatsStatusBucket,
  StatsWindow,
  StatsWorkDto,
  VideoStatsDto,
  VideoTemporalDto,
  WatchStaleness,
} from "@loomkeep/shared";
import { DORMANT_AFTER_DAYS } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { canonicalExternalId } from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
import { DomainGateService } from "../users/domain-gate.service";
import {
  type AdvancedStatsSource,
  EMPTY_BOOK_ADVANCED,
  EMPTY_GAME_ADVANCED,
  EMPTY_MUSIC_ADVANCED,
  EMPTY_SOCIAL_STATS,
  EMPTY_VIDEO_ADVANCED,
  emptyOverviewAdvanced,
  emptyVideoTemporal,
} from "./advanced-stats.source";
import { sumStatusBreakdowns } from "./cross-domain-totals.util";
import { decadeOf } from "./decade.util";
import { filterEnabledDomains } from "./enabled-domains.util";
import { computeAverageRating } from "./rating-distribution.util";
import {
  bucketizeBookStatus,
  bucketizeEntryStatus,
  bucketizeGameStatus,
  bucketizeMusicStatus,
  countByBucket,
} from "./status-bucket.util";
import {
  classifyStaleness,
  computeTypeSplit,
  countCompletedSeasons,
  lastWatchedPerMediaItem,
  runtimeFor,
  type TypeSplitInput,
} from "./video-stats.util";

/** One library entry, domain-agnostic, for the cross-domain aggregators below. */
interface DomainRow {
  bucket: StatsStatusBucket;
  favorite: boolean;
  ownershipStatus: string;
  releaseDate: Date | null;
  itemId: string;
  title: string;
  imageUrl: string | null;
  href: string;
}

const TARGET_TYPE: Record<StatsDomain, ReviewTargetType> = {
  MEDIA: "MEDIA",
  GAMES: "GAME",
  BOOKS: "BOOK",
  MUSIC: "MUSIC",
};

/**
 * Whether a work belongs to the clicked bar. Exactly one of `rating`/`decade`
 * is set (the controller rejects both), so the two branches never overlap.
 */
function matchesFilter(
  filter: { rating?: number; decade?: number },
  rating: number | null,
  releaseDate: Date | null,
): boolean {
  if (filter.rating !== undefined) {
    return rating !== null && Math.round(rating) === filter.rating;
  }

  if (filter.decade !== undefined) {
    return releaseDate !== null && decadeOf(releaseDate) === filter.decade;
  }

  return false;
}

@Injectable()
export class StatsService {
  private advanced: AdvancedStatsSource | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewService: ReviewService,
    private readonly domainGate: DomainGateService,
  ) {}

  /** Called by ee/stats at startup — see advanced-stats.source.ts. */
  setAdvancedStatsSource(source: AdvancedStatsSource): void {
    this.advanced = source;
  }

  async getOverview(
    userId: string,
    requested: StatsDomain | "ALL",
    premium: boolean,
  ): Promise<StatsOverviewDto> {
    const domains = await this.resolveDomains(userId, requested);
    const rows = await this.fetchRows(userId, domains);

    const breakdowns: DomainStatusBreakdownDto[] = domains.map((domain) => {
      const domainRows = rows.get(domain) ?? [];
      return {
        domain,
        total: domainRows.length,
        favorites: domainRows.filter((r) => r.favorite).length,
        byStatus: countByBucket(domainRows.map((r) => r.bucket)),
      };
    });

    const { total, favorites, byStatus } = sumStatusBreakdowns(breakdowns);
    const doneCount = byStatus.find((b) => b.bucket === "DONE")?.count ?? 0;
    const droppedCount =
      byStatus.find((b) => b.bucket === "DROPPED")?.count ?? 0;

    const allRows = domains.flatMap((d) => rows.get(d) ?? []);
    const ratings = await this.ratingsFor(userId, domains, rows);
    const advanced = premium
      ? this.advanced?.overview({ ratings, rows: allRows })
      : null;

    return {
      domain: requested,
      breakdowns,
      total,
      favorites,
      completionRate: total > 0 ? doneCount / total : 0,
      abandonRate: total > 0 ? droppedCount / total : 0,
      ratedCount: ratings.length,
      ratingRate: total > 0 ? ratings.length / total : 0,
      averageRating: computeAverageRating(ratings),
      ...(advanced ?? emptyOverviewAdvanced()),
    };
  }

  async getWorks(
    userId: string,
    requested: StatsDomain | "ALL",
    filter: { rating?: number; decade?: number },
  ): Promise<StatsWorkDto[]> {
    const domains = await this.resolveDomains(userId, requested);
    const rows = await this.fetchRows(userId, domains);

    const results: StatsWorkDto[] = [];

    for (const domain of domains) {
      const domainRows = rows.get(domain) ?? [];
      const ratingMap = await this.reviewService.getRatings(
        userId,
        TARGET_TYPE[domain],
        domainRows.map((r) => r.itemId),
      );

      for (const r of domainRows) {
        const rating = ratingMap.get(r.itemId) ?? null;

        if (matchesFilter(filter, rating, r.releaseDate)) {
          results.push({
            domain,
            title: r.title,
            imageUrl: r.imageUrl,
            rating,
            href: r.href,
          });
        }
      }
    }

    return results;
  }

  /** Intersects the user's enabled domains with the requested filter. */
  private async resolveDomains(
    userId: string,
    requested: StatsDomain | "ALL",
  ): Promise<StatsDomain[]> {
    const enabledDomains = await this.domainGate.getEnabledDomains(userId);
    return filterEnabledDomains(requested, enabledDomains);
  }

  private async ratingsFor(
    userId: string,
    domains: StatsDomain[],
    rows: Map<StatsDomain, DomainRow[]>,
  ): Promise<number[]> {
    const perDomain = await Promise.all(
      domains.map(async (domain) => {
        const domainRows = rows.get(domain) ?? [];
        const map = await this.reviewService.getRatings(
          userId,
          TARGET_TYPE[domain],
          domainRows.map((r) => r.itemId),
        );
        return [...map.values()];
      }),
    );
    return perDomain.flat();
  }

  private async fetchRows(
    userId: string,
    domains: StatsDomain[],
  ): Promise<Map<StatsDomain, DomainRow[]>> {
    const result = new Map<StatsDomain, DomainRow[]>();

    await Promise.all(
      domains.map(async (domain) => {
        switch (domain) {
          case "MEDIA":
            result.set("MEDIA", await this.fetchMediaRows(userId));
            break;
          case "GAMES":
            result.set("GAMES", await this.fetchGameRows(userId));
            break;
          case "BOOKS":
            result.set("BOOKS", await this.fetchBookRows(userId));
            break;
          case "MUSIC":
            result.set("MUSIC", await this.fetchMusicRows(userId));
            break;
        }
      }),
    );

    return result;
  }

  private async fetchMediaRows(userId: string): Promise<DomainRow[]> {
    const entries = await this.prisma.libraryEntry.findMany({
      where: { userId },
      select: {
        status: true,
        favorite: true,
        ownershipStatus: true,
        mediaItem: {
          select: {
            id: true,
            title: true,
            posterUrl: true,
            releaseDate: true,
            type: true,
            canonicalSource: true,
            externalIds: { select: { source: true, externalId: true } },
          },
        },
      },
    });

    return entries.map((e) => ({
      bucket: bucketizeEntryStatus(e.status),
      favorite: e.favorite,
      ownershipStatus: e.ownershipStatus,
      releaseDate: e.mediaItem.releaseDate,
      itemId: e.mediaItem.id,
      title: e.mediaItem.title,
      imageUrl: e.mediaItem.posterUrl,
      href: this.mediaHref(e.mediaItem),
    }));
  }

  /** Web route of a cached item, under the domain's own path prefix. */
  private itemHref(
    prefix: string,
    item: {
      canonicalSource: string;
      externalIds: { source: string; externalId: string }[];
    },
  ): string {
    return `/${prefix}/${canonicalExternalId(item, item.externalIds)}`;
  }

  // Video is the one domain whose route carries the media type as well.
  private mediaHref(item: {
    type: string;
    canonicalSource: string;
    externalIds: { source: string; externalId: string }[];
  }): string {
    return this.itemHref(`media/${item.type.toLowerCase()}`, item);
  }

  private async fetchGameRows(userId: string): Promise<DomainRow[]> {
    const entries = await this.prisma.gameEntry.findMany({
      where: { userId },
      select: {
        status: true,
        favorite: true,
        ownershipStatus: true,
        gameItem: {
          select: {
            id: true,
            title: true,
            coverUrl: true,
            releaseDate: true,
            canonicalSource: true,
            externalIds: { select: { source: true, externalId: true } },
          },
        },
      },
    });

    return entries.map((e) => ({
      bucket: bucketizeGameStatus(e.status),
      favorite: e.favorite,
      ownershipStatus: e.ownershipStatus,
      releaseDate: e.gameItem.releaseDate,
      itemId: e.gameItem.id,
      title: e.gameItem.title,
      imageUrl: e.gameItem.coverUrl,
      href: this.itemHref("games", e.gameItem),
    }));
  }

  private async fetchBookRows(userId: string): Promise<DomainRow[]> {
    const entries = await this.prisma.bookEntry.findMany({
      where: { userId },
      select: {
        status: true,
        favorite: true,
        ownershipStatus: true,
        bookItem: {
          select: {
            id: true,
            title: true,
            coverUrl: true,
            releaseDate: true,
            canonicalSource: true,
            externalIds: { select: { source: true, externalId: true } },
          },
        },
      },
    });

    return entries.map((e) => ({
      bucket: bucketizeBookStatus(e.status),
      favorite: e.favorite,
      ownershipStatus: e.ownershipStatus,
      releaseDate: e.bookItem.releaseDate,
      itemId: e.bookItem.id,
      title: e.bookItem.title,
      imageUrl: e.bookItem.coverUrl,
      href: this.itemHref("books", e.bookItem),
    }));
  }

  private async fetchMusicRows(userId: string): Promise<DomainRow[]> {
    const entries = await this.prisma.musicEntry.findMany({
      where: { userId },
      select: {
        status: true,
        favorite: true,
        ownershipStatus: true,
        musicItem: {
          select: {
            id: true,
            title: true,
            coverUrl: true,
            releaseDate: true,
            canonicalSource: true,
            externalIds: { select: { source: true, externalId: true } },
          },
        },
      },
    });

    return entries.map((e) => ({
      bucket: bucketizeMusicStatus(e.status),
      favorite: e.favorite,
      ownershipStatus: e.ownershipStatus,
      releaseDate: e.musicItem.releaseDate,
      itemId: e.musicItem.id,
      title: e.musicItem.title,
      imageUrl: e.musicItem.coverUrl,
      href: this.itemHref("music", e.musicItem),
    }));
  }

  async getVideoStats(
    userId: string,
    premium: boolean,
  ): Promise<VideoStatsDto> {
    const [entries, watches] = await Promise.all([
      this.prisma.libraryEntry.findMany({
        where: { userId },
        select: {
          status: true,
          mediaItem: {
            select: {
              id: true,
              title: true,
              type: true,
              runtimeMin: true,
              genres: true,
              canonicalSource: true,
              externalIds: { select: { source: true, externalId: true } },
            },
          },
          _count: { select: { replays: true } },
        },
      }),
      this.prisma.episodeWatch.findMany({
        // Season 0 (TMDB specials) never counts towards progression, so it
        // is excluded here rather than loaded and dropped in memory.
        where: { userId, episode: { season: { number: { not: 0 } } } },
        select: {
          watchedAt: true,
          episode: {
            select: {
              id: true,
              seasonId: true,
              season: {
                select: {
                  mediaItemId: true,
                  mediaItem: {
                    select: { type: true, genres: true, runtimeMin: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const regularWatches = watches;
    const typeSplitRows: TypeSplitInput[] = [];
    let episodeMinutes = 0;

    for (const w of regularWatches) {
      const mi = w.episode.season.mediaItem;
      const minutes = runtimeFor(mi.type, mi.runtimeMin);
      episodeMinutes += minutes;
      typeSplitRows.push({ type: mi.type, minutes });
    }

    const completedMovies = entries.filter(
      (e) => e.status === "COMPLETED" && e.mediaItem.type === "MOVIE",
    );
    let movieMinutes = 0;

    for (const m of completedMovies) {
      const minutes = runtimeFor("MOVIE", m.mediaItem.runtimeMin);
      // Rewatches count too, same as episodes' regularWatches above.
      const instances = 1 + m._count.replays;
      movieMinutes += minutes * instances;

      for (let i = 0; i < instances; i++) {
        typeSplitRows.push({ type: "MOVIE", minutes });
      }
    }

    // Distinct watched episode ids per season, to weigh against how many of
    // that season's episodes have aired so far ("à jour" = completed).
    const watchedEpisodesBySeason = new Map<string, Set<string>>();

    for (const w of regularWatches) {
      const set = watchedEpisodesBySeason.get(w.episode.seasonId) ?? new Set();
      set.add(w.episode.id);
      watchedEpisodesBySeason.set(w.episode.seasonId, set);
    }

    const seasonIds = [...watchedEpisodesBySeason.keys()];
    const seasons =
      seasonIds.length > 0
        ? await this.prisma.season.findMany({
            where: { id: { in: seasonIds } },
            select: {
              id: true,
              episodes: { select: { id: true, airDate: true } },
            },
          })
        : [];
    const now = new Date();
    const seasonProgress = seasons.map((s) => {
      const released = s.episodes.filter(
        (e) => e.airDate === null || e.airDate <= now,
      );
      return {
        totalEpisodes: released.length,
        watchedEpisodes: released.filter((e) =>
          watchedEpisodesBySeason.get(s.id)?.has(e.id),
        ).length,
      };
    });

    const advanced = premium
      ? await this.advanced?.video(userId, {
          episodeWatches: regularWatches.map((w) => ({
            watchedAt: w.watchedAt,
            genres: w.episode.season.mediaItem.genres,
          })),
          completedMovies: completedMovies.map((m) => ({
            title: m.mediaItem.title,
            runtimeMin: m.mediaItem.runtimeMin,
            genres: m.mediaItem.genres,
            href: this.mediaHref(m.mediaItem),
            viewings: 1 + m._count.replays,
          })),
        })
      : null;

    return {
      totalMinutes: episodeMinutes + movieMinutes,
      episodesWatched: regularWatches.length,
      uniqueEpisodesWatched: new Set(regularWatches.map((w) => w.episode.id))
        .size,
      seasonsCompleted: countCompletedSeasons(seasonProgress),
      typeSplit: computeTypeSplit(typeSplitRows),
      avgEpisodeRuntimeMin:
        regularWatches.length > 0
          ? Math.round(episodeMinutes / regularWatches.length)
          : null,
      ...(advanced ?? EMPTY_VIDEO_ADVANCED),
    };
  }

  async getVideoSeries(
    userId: string,
    kind: WatchStaleness,
  ): Promise<StatsWorkDto[]> {
    const staleness = await this.fetchInProgressStaleness(userId);
    const matching = staleness.filter((s) => s.staleness === kind);
    const ratingMap = await this.reviewService.getRatings(
      userId,
      "MEDIA",
      matching.map((s) => s.mediaItem.id),
    );

    return matching.map((s) => ({
      domain: "MEDIA",
      title: s.mediaItem.title,
      imageUrl: s.mediaItem.posterUrl,
      rating: ratingMap.get(s.mediaItem.id) ?? null,
      href: this.mediaHref(s.mediaItem),
    }));
  }

  // WATCHING series/anime (movies have no "in progress"), paired with how
  // stale their last viewing is — only entries actually touched at least
  // once (a never-started show is neither paused nor a ghost). Public for
  // ee/stats, which counts the paused and ghost ones.
  async fetchInProgressStaleness(userId: string): Promise<
    {
      mediaItem: {
        id: string;
        title: string;
        posterUrl: string | null;
        type: string;
        canonicalSource: string;
        externalIds: { source: string; externalId: string }[];
      };
      staleness: WatchStaleness;
    }[]
  > {
    const entries = await this.prisma.libraryEntry.findMany({
      where: { userId, status: "WATCHING" },
      select: {
        mediaItem: {
          select: {
            id: true,
            title: true,
            posterUrl: true,
            type: true,
            canonicalSource: true,
            externalIds: { select: { source: true, externalId: true } },
          },
        },
      },
    });

    // Only series still in progress are ever looked up below, so the watch
    // history is scoped to those rather than loaded whole. Sequential instead
    // of parallel with the query above, which is what makes the scoping
    // possible — and the second query is now a fraction of its old size.
    const inProgressIds = entries
      .filter((e) => e.mediaItem.type !== "MOVIE")
      .map((e) => e.mediaItem.id);
    const watches =
      inProgressIds.length > 0
        ? await this.prisma.episodeWatch.findMany({
            where: {
              userId,
              watchedAt: { not: null },
              episode: { season: { mediaItemId: { in: inProgressIds } } },
            },
            select: {
              watchedAt: true,
              episode: {
                select: { season: { select: { mediaItemId: true } } },
              },
            },
          })
        : [];

    const lastWatchedMap = lastWatchedPerMediaItem(
      watches.flatMap((w) =>
        w.watchedAt
          ? [
              {
                mediaItemId: w.episode.season.mediaItemId,
                watchedAt: w.watchedAt,
              },
            ]
          : [],
      ),
    );

    const result: {
      mediaItem: (typeof entries)[number]["mediaItem"];
      staleness: WatchStaleness;
    }[] = [];

    for (const e of entries) {
      if (e.mediaItem.type === "MOVIE") continue;
      const lastTouched = lastWatchedMap.get(e.mediaItem.id);
      if (!lastTouched) continue;
      const staleness = classifyStaleness(lastTouched);
      if (staleness) result.push({ mediaItem: e.mediaItem, staleness });
    }

    return result;
  }

  async getGameStats(userId: string, premium: boolean): Promise<GameStatsDto> {
    const [entries, replaysCount] = await Promise.all([
      this.prisma.gameEntry.findMany({
        where: { userId },
        select: {
          status: true,
          playtimeMinutes: true,
          gameItem: {
            select: {
              id: true,
              title: true,
              genres: true,
              platforms: true,
              canonicalSource: true,
              externalIds: { select: { source: true, externalId: true } },
            },
          },
        },
      }),
      this.prisma.gameReplay.count({
        where: { gameEntry: { userId } },
      }),
    ]);

    const completed = entries.filter((e) => e.status === "COMPLETED");
    const totalPlaytimeMinutes = entries.reduce(
      (sum, e) => sum + e.playtimeMinutes,
      0,
    );
    const advanced = premium
      ? await this.advanced?.games(userId, {
          entries: entries.map((e) => ({
            itemId: e.gameItem.id,
            title: e.gameItem.title,
            href: this.itemHref("games", e.gameItem),
            playtimeMinutes: e.playtimeMinutes,
            genres: e.gameItem.genres,
            platforms: e.gameItem.platforms,
          })),
        })
      : null;

    return {
      totalPlaytimeMinutes,
      avgPlaytimePerCompletedMinutes:
        completed.length > 0
          ? Math.round(
              completed.reduce((sum, e) => sum + e.playtimeMinutes, 0) /
                completed.length,
            )
          : null,
      neverLaunchedCount: entries.filter((e) => e.playtimeMinutes === 0).length,
      replaysCount,
      ...(advanced ?? EMPTY_GAME_ADVANCED),
    };
  }

  async getBookStats(userId: string, premium: boolean): Promise<BookStatsDto> {
    const [entries, rereadsCount] = await Promise.all([
      this.prisma.bookEntry.findMany({
        where: { userId },
        select: {
          status: true,
          currentPage: true,
          updatedAt: true,
          bookItem: {
            select: {
              title: true,
              authors: true,
              pageCount: true,
              canonicalSource: true,
              externalIds: { select: { source: true, externalId: true } },
            },
          },
        },
      }),
      this.prisma.bookReplay.count({
        where: { bookEntry: { userId } },
      }),
    ]);

    const read = entries.filter((e) => e.status === "READ");
    const reading = entries.filter((e) => e.status === "READING");

    const pagesRead =
      read.reduce(
        (sum, e) => sum + (e.bookItem.pageCount ?? e.currentPage),
        0,
      ) + reading.reduce((sum, e) => sum + e.currentPage, 0);

    const readPageCounts = read.flatMap((e) =>
      e.bookItem.pageCount !== null && e.bookItem.pageCount > 0
        ? [e.bookItem.pageCount]
        : [],
    );

    const now = new Date();
    const stagnantInProgressCount = reading.filter(
      (e) =>
        (now.getTime() - e.updatedAt.getTime()) / (24 * 60 * 60 * 1000) >=
        DORMANT_AFTER_DAYS,
    ).length;

    const advanced = premium
      ? this.advanced?.books({
          entries: entries.map((e) => ({
            status: e.status,
            title: e.bookItem.title,
            href: this.itemHref("books", e.bookItem),
            pageCount: e.bookItem.pageCount,
            authors: e.bookItem.authors,
          })),
        })
      : null;

    return {
      pagesRead,
      avgPagesPerRead:
        readPageCounts.length > 0
          ? Math.round(
              readPageCounts.reduce((sum, pages) => sum + pages, 0) /
                readPageCounts.length,
            )
          : null,
      rereadsCount,
      stagnantInProgressCount,
      ...(advanced ?? EMPTY_BOOK_ADVANCED),
    };
  }

  async getMusicStats(
    userId: string,
    premium: boolean,
  ): Promise<MusicStatsDto> {
    const entries = await this.prisma.musicEntry.findMany({
      where: { userId },
      select: {
        status: true,
        musicItem: {
          select: {
            artists: true,
            trackCount: true,
            durationMin: true,
            albumType: true,
          },
        },
      },
    });

    const listened = entries.filter((e) => e.status === "LISTENED");
    const listenDurationMin = listened.reduce(
      (sum, e) => sum + (e.musicItem.durationMin ?? 0),
      0,
    );
    const totalTracks = entries.reduce(
      (sum, e) => sum + (e.musicItem.trackCount ?? 0),
      0,
    );
    const advanced = premium
      ? this.advanced?.music({
          entries: entries.map((e) => ({
            artists: e.musicItem.artists,
            albumType: e.musicItem.albumType,
          })),
        })
      : null;

    return {
      listenDurationMin,
      totalTracks,
      distinctArtistsCount: new Set(entries.flatMap((e) => e.musicItem.artists))
        .size,
      ...(advanced ?? EMPTY_MUSIC_ADVANCED),
    };
  }

  /** Entirely advanced: computed by ee/stats, empty without it. */
  async getVideoTemporal(
    userId: string,
    period: StatsWindow,
    premium: boolean,
  ): Promise<VideoTemporalDto> {
    const advanced = premium
      ? await this.advanced?.videoTemporal(userId, period)
      : null;
    return advanced ?? emptyVideoTemporal();
  }

  /**
   * Entirely advanced, like getVideoTemporal. The controller gates this
   * section with SOCIAL_ENABLED. Stats are self-only.
   */
  async getSocialStats(
    userId: string,
    premium: boolean,
  ): Promise<SocialStatsDto> {
    const advanced = premium ? await this.advanced?.social(userId) : null;
    return advanced ?? EMPTY_SOCIAL_STATS;
  }
}
