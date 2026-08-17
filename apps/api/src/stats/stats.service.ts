import { Injectable } from "@nestjs/common";
import type {
  BookStatsDto,
  DomainStatusBreakdownDto,
  GameStatsDto,
  LabelCountDto,
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
import { canonicalExternalId } from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
import { DomainGateService } from "../users/domain-gate.service";
import {
  computeAverageRating,
  computeRatingDistribution,
} from "./rating-distribution.util";
import { computePossessionBreakdown } from "./possession.util";
import { computeDecadeHistogram, decadeOf } from "./decade.util";
import { sumStatusBreakdowns } from "./cross-domain-totals.util";
import { filterEnabledDomains } from "./enabled-domains.util";
import { computeAverageRatingByGroup } from "./rating-by-group.util";
import {
  bucketizeBookStatus,
  bucketizeEntryStatus,
  bucketizeGameStatus,
  bucketizeMusicStatus,
  countByBucket,
} from "./status-bucket.util";
import {
  classifyStaleness,
  computeLongestBinge,
  computeTypeSplit,
  countCompletedSeasons,
  lastWatchedPerMediaItem,
  runtimeFor,
  type TypeSplitInput,
} from "./video-stats.util";
import {
  computeHeatmap,
  computeHourCounts,
  computeMonthlyCounts,
  computeMonthlyMinutes,
  computeStreak,
  computeWeekdayCounts,
  computeYearlyMinutes,
  mostActiveYear,
  windowStart,
} from "./video-temporal.util";
import {
  computeAvgReviewLength,
  computeReciprocityRate,
  computeRatingVsCommunity,
  computeSpoilerRatio,
} from "./social-stats.util";

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

/** Tallied labels as a ranked list, most frequent first. */
function toRankedList(counts: Map<string, number>): LabelCountDto[] {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewService: ReviewService,
    private readonly domainGate: DomainGateService,
  ) {}

  async getOverview(
    userId: string,
    requested: StatsDomain | "ALL",
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
      ratingDistribution: computeRatingDistribution(ratings),
      decades: computeDecadeHistogram(allRows.map((r) => r.releaseDate)),
      possession: computePossessionBreakdown(
        allRows.map((r) => r.ownershipStatus),
      ),
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

  // --- Vidéo deep section — everything the cross-domain overview doesn't
  //     already cover (statuses/favorites live in getOverview's breakdowns). ---

  async getVideoStats(userId: string): Promise<VideoStatsDto> {
    const [entries, watches, staleness, moviesRewatchedCount] =
      await Promise.all([
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
          where: { userId },
          select: {
            watchedAt: true,
            episode: {
              select: {
                id: true,
                seasonId: true,
                season: {
                  select: {
                    number: true,
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
        this.fetchInProgressStaleness(userId),
        this.prisma.movieReplay.count({
          where: { libraryEntry: { userId } },
        }),
      ]);

    const regularWatches = watches.filter((w) => w.episode.season.number !== 0);
    const genreCounts = new Map<string, number>();
    const typeSplitRows: TypeSplitInput[] = [];
    let episodeMinutes = 0;

    for (const w of regularWatches) {
      const mi = w.episode.season.mediaItem;
      const minutes = runtimeFor(mi.type, mi.runtimeMin);
      episodeMinutes += minutes;
      typeSplitRows.push({ type: mi.type, minutes });
      for (const g of mi.genres)
        genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
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

      for (const g of m.mediaItem.genres) {
        genreCounts.set(g, (genreCounts.get(g) ?? 0) + instances);
      }
    }

    const moviesWithRuntime = completedMovies.filter(
      (m) => m.mediaItem.runtimeMin !== null && m.mediaItem.runtimeMin > 0,
    );
    const sortedByRuntime = moviesWithRuntime.sort(
      (a, b) => b.mediaItem.runtimeMin! - a.mediaItem.runtimeMin!,
    );
    const longest = sortedByRuntime[0];
    const shortest = sortedByRuntime[sortedByRuntime.length - 1];

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
      longestFilm: longest
        ? {
            title: longest.mediaItem.title,
            minutes: longest.mediaItem.runtimeMin!,
            href: this.mediaHref(longest.mediaItem),
          }
        : null,
      shortestFilm: shortest
        ? {
            title: shortest.mediaItem.title,
            minutes: shortest.mediaItem.runtimeMin!,
            href: this.mediaHref(shortest.mediaItem),
          }
        : null,
      genres: [...genreCounts.entries()]
        .map(([genre, count]) => ({ genre, count }))
        .sort((a, b) => b.count - a.count),
      pausedCount: staleness.filter((s) => s.staleness === "PAUSED").length,
      ghostCount: staleness.filter((s) => s.staleness === "GHOST").length,
      moviesRewatchedCount,
      longestBingeCount: computeLongestBinge(
        regularWatches.map((w) => w.watchedAt),
      ),
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
  // once (a never-started show is neither paused nor a ghost).
  private async fetchInProgressStaleness(userId: string): Promise<
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
    const [entries, watches] = await Promise.all([
      this.prisma.libraryEntry.findMany({
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
      }),
      this.prisma.episodeWatch.findMany({
        where: { userId },
        select: {
          watchedAt: true,
          episode: { select: { season: { select: { mediaItemId: true } } } },
        },
      }),
    ]);

    const lastWatchedMap = lastWatchedPerMediaItem(
      watches.map((w) => ({
        mediaItemId: w.episode.season.mediaItemId,
        watchedAt: w.watchedAt,
      })),
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

  // --- Jeux deep section — everything the cross-domain overview doesn't
  //     already cover (statuses/favorites/decades live in getOverview). ---

  async getGameStats(userId: string): Promise<GameStatsDto> {
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

    const ratingMap = await this.reviewService.getRatings(
      userId,
      "GAME",
      entries.map((e) => e.gameItem.id),
    );

    const completed = entries.filter((e) => e.status === "COMPLETED");
    const totalPlaytimeMinutes = entries.reduce(
      (sum, e) => sum + e.playtimeMinutes,
      0,
    );

    const topGamesByPlaytime = entries
      .filter((e) => e.playtimeMinutes > 0)
      .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
      .map((e) => ({
        title: e.gameItem.title,
        minutes: e.playtimeMinutes,
        href: this.itemHref("games", e.gameItem),
      }));

    const platformCounts = new Map<string, number>();
    const genreCounts = new Map<string, number>();

    for (const e of entries) {
      for (const p of e.gameItem.platforms) {
        platformCounts.set(p, (platformCounts.get(p) ?? 0) + 1);
      }

      for (const g of e.gameItem.genres) {
        genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
      }
    }

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
      topGamesByPlaytime,
      topPlatforms: toRankedList(platformCounts),
      topGenres: toRankedList(genreCounts),
      avgRatingByPlatform: computeAverageRatingByGroup(
        entries.map((e) => ({
          groups: e.gameItem.platforms,
          rating: ratingMap.get(e.gameItem.id) ?? null,
        })),
      ),
      avgRatingByGenre: computeAverageRatingByGroup(
        entries.map((e) => ({
          groups: e.gameItem.genres,
          rating: ratingMap.get(e.gameItem.id) ?? null,
        })),
      ),
    };
  }

  // --- Livres deep section — everything the cross-domain overview doesn't
  //     already cover (statuses/favorites/decades/possession/ratings live in
  //     getOverview). ---

  async getBookStats(userId: string): Promise<BookStatsDto> {
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

    const readWithPages = read.filter(
      (e) => e.bookItem.pageCount !== null && e.bookItem.pageCount > 0,
    );
    const sortedByPages = [...readWithPages].sort(
      (a, b) => b.bookItem.pageCount! - a.bookItem.pageCount!,
    );
    const longest = sortedByPages[0];
    const shortest = sortedByPages[sortedByPages.length - 1];

    const pagesByAuthor = new Map<string, number>();

    for (const e of readWithPages) {
      for (const author of e.bookItem.authors) {
        pagesByAuthor.set(
          author,
          (pagesByAuthor.get(author) ?? 0) + e.bookItem.pageCount!,
        );
      }
    }

    const distinctAuthors = new Set(entries.flatMap((e) => e.bookItem.authors));

    const now = new Date();
    const stagnantInProgressCount = reading.filter(
      (e) =>
        (now.getTime() - e.updatedAt.getTime()) / (24 * 60 * 60 * 1000) >=
        DORMANT_AFTER_DAYS,
    ).length;

    return {
      pagesRead,
      avgPagesPerRead:
        readWithPages.length > 0
          ? Math.round(
              readWithPages.reduce((sum, e) => sum + e.bookItem.pageCount!, 0) /
                readWithPages.length,
            )
          : null,
      longestBook: longest
        ? {
            title: longest.bookItem.title,
            pages: longest.bookItem.pageCount!,
            href: this.itemHref("books", longest.bookItem),
          }
        : null,
      shortestBook: shortest
        ? {
            title: shortest.bookItem.title,
            pages: shortest.bookItem.pageCount!,
            href: this.itemHref("books", shortest.bookItem),
          }
        : null,
      topAuthorsByPages: [...pagesByAuthor.entries()]
        .map(([author, pages]) => ({ author, pages }))
        .sort((a, b) => b.pages - a.pages),
      distinctAuthorsCount: distinctAuthors.size,
      rereadsCount,
      stagnantInProgressCount,
    };
  }

  // --- Musique deep section — everything the cross-domain overview doesn't
  //     already cover (statuses/favorites/decades/possession/ratings live in
  //     getOverview). ---

  async getMusicStats(userId: string): Promise<MusicStatsDto> {
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

    const artistCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();

    for (const e of entries) {
      for (const artist of e.musicItem.artists) {
        artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
      }

      const type = e.musicItem.albumType ?? "Autre";
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    }

    return {
      listenDurationMin,
      totalTracks,
      distinctArtistsCount: artistCounts.size,
      topArtists: toRankedList(artistCounts),
      releaseTypeSplit: toRankedList(typeCounts),
    };
  }

  // --- Vidéo "activité dans le temps" — the only domain with a true
  //     per-event log (EpisodeWatch). The heatmap and monthly/yearly bars
  //     always span their own natural full range; only the weekday/hour
  //     curves respect `period`. ---

  async getVideoTemporal(
    userId: string,
    period: StatsWindow,
  ): Promise<VideoTemporalDto> {
    const watches = await this.prisma.episodeWatch.findMany({
      where: { userId },
      select: {
        watchedAt: true,
        episode: {
          select: {
            season: {
              select: {
                number: true,
                mediaItem: { select: { type: true, runtimeMin: true } },
              },
            },
          },
        },
      },
    });

    const regular = watches.filter((w) => w.episode.season.number !== 0);
    const now = new Date();
    const start = windowStart(period, now);
    const inWindow = start
      ? regular.filter((w) => w.watchedAt >= start)
      : regular;

    const datedMinutes = regular.map((w) => ({
      watchedAt: w.watchedAt,
      minutes: runtimeFor(
        w.episode.season.mediaItem.type,
        w.episode.season.mediaItem.runtimeMin,
      ),
    }));
    const yearlyMinutes = computeYearlyMinutes(datedMinutes);

    return {
      heatmap: computeHeatmap(
        regular.map((w) => w.watchedAt),
        365,
        now,
      ),
      byWeekday: computeWeekdayCounts(inWindow.map((w) => w.watchedAt)),
      byHour: computeHourCounts(inWindow.map((w) => w.watchedAt)),
      monthlyMinutes: computeMonthlyMinutes(datedMinutes, 12, now),
      yearlyMinutes,
      mostActiveYear: mostActiveYear(yearlyMinutes),
    };
  }

  // --- Social section — gated by SOCIAL_ENABLED on the controller. Always
  //     self-view (no visibility checks needed, mirrors /stats itself). ---

  async getSocialStats(userId: string): Promise<SocialStatsDto> {
    const now = new Date();
    const twelveMonthsAgo = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
    );

    const [
      reviews,
      comments,
      reactionsGiven,
      reactionsReceived,
      lists,
      newFollowers,
    ] = await Promise.all([
      this.prisma.review.findMany({
        where: { userId },
        select: {
          targetType: true,
          targetId: true,
          rating: true,
          text: true,
          createdAt: true,
          _count: { select: { revisions: true } },
          votes: { select: { value: true } },
        },
      }),
      this.prisma.comment.findMany({
        where: { authorId: userId, deletedAt: null },
        select: { parentId: true, spoilerTag: true, createdAt: true },
      }),
      this.prisma.commentReaction.count({ where: { userId } }),
      this.prisma.commentReaction.count({
        where: { comment: { authorId: userId } },
      }),
      this.prisma.list.findMany({
        where: { userId },
        select: { visibility: true },
      }),
      this.prisma.follow.findMany({
        where: {
          followeeId: userId,
          status: "ACCEPTED",
          createdAt: { gte: twelveMonthsAgo },
        },
        select: { followerId: true, createdAt: true },
      }),
    ]);

    const communityRatings = await this.fetchCommunityRatings(userId, reviews);
    const votesUp = reviews.map(
      (r) => r.votes.filter((v) => v.value === "UP").length,
    );

    const viewerFollowsIds = await this.fetchFollowedBackIds(
      userId,
      newFollowers.map((f) => f.followerId),
    );

    const socialActivityDates = [
      ...reviews.map((r) => r.createdAt),
      ...comments.map((c) => c.createdAt),
    ];

    return {
      reviewsWritten: reviews.length,
      avgReviewLength: computeAvgReviewLength(reviews.map((r) => r.text)),
      ratingVsCommunity: computeRatingVsCommunity(
        reviews.map((r) => ({
          yourRating: r.rating,
          otherRatings:
            communityRatings.get(`${r.targetType}:${r.targetId}`) ?? [],
        })),
      ),
      commentsWritten: comments.length,
      rootCommentsCount: comments.filter((c) => c.parentId === null).length,
      replyCommentsCount: comments.filter((c) => c.parentId !== null).length,
      spoilerCommentRatio: computeSpoilerRatio(comments),
      reviewRevisionsCount: reviews.reduce(
        (sum, r) => sum + r._count.revisions,
        0,
      ),
      helpfulVotesReceived: votesUp.reduce((sum, n) => sum + n, 0),
      mostVotedReviewVotes: votesUp.length > 0 ? Math.max(...votesUp) : null,
      reactionsGiven,
      reactionsReceived,
      listsWritten: lists.length,
      listsPublicCount: lists.filter((l) => l.visibility === "PUBLIC").length,
      newFollowersByMonth: computeMonthlyCounts(
        newFollowers.map((f) => f.createdAt),
        12,
        now,
      ),
      followerReciprocityRate: computeReciprocityRate(
        newFollowers.map((f) => f.followerId),
        viewerFollowsIds,
      ),
      socialActivityByMonth: computeMonthlyCounts(socialActivityDates, 12, now),
      contributionStreakDays: computeStreak(socialActivityDates, now),
    };
  }

  /** Which of `candidateIds` the viewer follows back (accepted), for reciprocity. */
  private async fetchFollowedBackIds(
    userId: string,
    candidateIds: string[],
  ): Promise<Set<string>> {
    if (candidateIds.length === 0) return new Set();

    const rows = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
        followeeId: { in: candidateIds },
        status: "ACCEPTED",
      },
      select: { followeeId: true },
    });

    return new Set(rows.map((f) => f.followeeId));
  }

  // Other users' ratings on the same works the viewer reviewed, grouped by
  // "targetType:targetId" — grouped per targetType since Prisma can't filter
  // a compound (targetType, targetId) pair list in one `in` clause.
  private async fetchCommunityRatings(
    userId: string,
    reviews: { targetType: string; targetId: string }[],
  ): Promise<Map<string, number[]>> {
    const idsByType = new Map<string, string[]>();

    for (const r of reviews) {
      const arr = idsByType.get(r.targetType) ?? [];
      arr.push(r.targetId);
      idsByType.set(r.targetType, arr);
    }

    const result = new Map<string, number[]>();

    await Promise.all(
      [...idsByType.entries()].map(async ([targetType, targetIds]) => {
        const rows = await this.prisma.review.findMany({
          where: {
            targetType: targetType as ReviewTargetType,
            targetId: { in: targetIds },
            userId: { not: userId },
          },
          select: { targetId: true, rating: true },
        });

        for (const row of rows) {
          const key = `${targetType}:${row.targetId}`;
          const arr = result.get(key) ?? [];
          arr.push(row.rating);
          result.set(key, arr);
        }
      }),
    );

    return result;
  }
}
