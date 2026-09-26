import type {
  ReviewTargetType,
  SocialStatsDto,
  StatsWindow,
  VideoTemporalDto,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ReviewService } from "../../reviews/review.service";
import type {
  AdvancedStatsSource,
  BookAdvanced,
  BookInput,
  GameAdvanced,
  GameInput,
  MusicAdvanced,
  MusicInput,
  OverviewAdvanced,
  OverviewInput,
  VideoAdvanced,
  VideoInput,
} from "../../stats/advanced-stats.source";
import { computeRatingDistribution } from "../../stats/rating-distribution.util";
import { StatsService } from "../../stats/stats.service";
import { episodeRuntimeFor } from "../../stats/video-stats.util";
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
} from "../../stats/video-temporal.util";
import { LicenseService } from "../licensing/license.service";
import {
  computeDecadeHistogram,
  computeLongestBinge,
  toRankedList,
} from "./aggregates.util";
import { computePossessionBreakdown } from "./possession.util";
import { computeAverageRatingByGroup } from "./rating-by-group.util";
import {
  computeAvgReviewLength,
  computeRatingVsCommunity,
  computeReciprocityRate,
  computeSpoilerRatio,
} from "./social-stats.util";

/**
 * The advanced statistics (rankings, comparisons, timelines). StatsService
 * computes the free fields and calls in here for the rest, only for a
 * premium account: this service only checks the instance license.
 */
@Injectable()
export class AdvancedStatsService implements AdvancedStatsSource {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewService: ReviewService,
    private readonly stats: StatsService,
    private readonly license: LicenseService,
  ) {
    stats.setAdvancedStatsSource(this);
  }

  overview({ ratings, rows }: OverviewInput): OverviewAdvanced | null {
    if (!this.license.isActive()) return null;

    return {
      ratingDistribution: computeRatingDistribution(ratings),
      decades: computeDecadeHistogram(rows.map((r) => r.releaseDate)),
      possession: computePossessionBreakdown(
        rows.map((r) => r.ownershipStatus),
      ),
    };
  }

  async video(
    userId: string,
    { episodeWatches, completedMovies }: VideoInput,
  ): Promise<VideoAdvanced | null> {
    if (!this.license.isActive()) return null;

    const [staleness, moviesRewatchedCount] = await Promise.all([
      this.stats.fetchInProgressStaleness(userId),
      this.prisma.movieReplay.count({
        where: { libraryEntry: { userId } },
      }),
    ]);

    const genreCounts = new Map<string, number>();

    for (const w of episodeWatches) {
      for (const g of w.genres) {
        genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
      }
    }

    for (const m of completedMovies) {
      for (const g of m.genres) {
        genreCounts.set(g, (genreCounts.get(g) ?? 0) + m.viewings);
      }
    }

    const sortedByRuntime = completedMovies
      .filter((m) => m.runtimeMin !== null && m.runtimeMin > 0)
      .sort((a, b) => b.runtimeMin! - a.runtimeMin!);
    const longest = sortedByRuntime[0];
    const shortest = sortedByRuntime[sortedByRuntime.length - 1];

    return {
      longestFilm: longest
        ? {
            title: longest.title,
            minutes: longest.runtimeMin!,
            href: longest.href,
          }
        : null,
      shortestFilm: shortest
        ? {
            title: shortest.title,
            minutes: shortest.runtimeMin!,
            href: shortest.href,
          }
        : null,
      genres: [...genreCounts.entries()]
        .map(([genre, count]) => ({ genre, count }))
        .sort((a, b) => b.count - a.count),
      pausedCount: staleness.filter((s) => s.staleness === "PAUSED").length,
      ghostCount: staleness.filter((s) => s.staleness === "GHOST").length,
      moviesRewatchedCount,
      longestBingeCount: computeLongestBinge(
        episodeWatches.flatMap((w) => (w.watchedAt ? [w.watchedAt] : [])),
      ),
    };
  }

  async games(
    userId: string,
    { entries }: GameInput,
  ): Promise<GameAdvanced | null> {
    if (!this.license.isActive()) return null;

    const ratingMap = await this.reviewService.getRatings(
      userId,
      "GAME",
      entries.map((e) => e.itemId),
    );

    const platformCounts = new Map<string, number>();
    const genreCounts = new Map<string, number>();

    for (const e of entries) {
      for (const p of e.platforms) {
        platformCounts.set(p, (platformCounts.get(p) ?? 0) + 1);
      }

      for (const g of e.genres) {
        genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
      }
    }

    return {
      topGamesByPlaytime: entries
        .filter((e) => e.playtimeMinutes > 0)
        .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
        .map((e) => ({
          title: e.title,
          minutes: e.playtimeMinutes,
          href: e.href,
        })),
      topPlatforms: toRankedList(platformCounts),
      topGenres: toRankedList(genreCounts),
      avgRatingByPlatform: computeAverageRatingByGroup(
        entries.map((e) => ({
          groups: e.platforms,
          rating: ratingMap.get(e.itemId) ?? null,
        })),
      ),
      avgRatingByGenre: computeAverageRatingByGroup(
        entries.map((e) => ({
          groups: e.genres,
          rating: ratingMap.get(e.itemId) ?? null,
        })),
      ),
    };
  }

  books({ entries }: BookInput): BookAdvanced | null {
    if (!this.license.isActive()) return null;

    const readWithPages = entries.filter(
      (e) => e.status === "READ" && e.pageCount !== null && e.pageCount > 0,
    );
    const sortedByPages = [...readWithPages].sort(
      (a, b) => b.pageCount! - a.pageCount!,
    );
    const longest = sortedByPages[0];
    const shortest = sortedByPages[sortedByPages.length - 1];

    const pagesByAuthor = new Map<string, number>();

    for (const e of readWithPages) {
      for (const author of e.authors) {
        pagesByAuthor.set(
          author,
          (pagesByAuthor.get(author) ?? 0) + e.pageCount!,
        );
      }
    }

    return {
      longestBook: longest
        ? {
            title: longest.title,
            pages: longest.pageCount!,
            href: longest.href,
          }
        : null,
      shortestBook: shortest
        ? {
            title: shortest.title,
            pages: shortest.pageCount!,
            href: shortest.href,
          }
        : null,
      topAuthorsByPages: [...pagesByAuthor.entries()]
        .map(([author, pages]) => ({ author, pages }))
        .sort((a, b) => b.pages - a.pages),
      distinctAuthorsCount: new Set(entries.flatMap((e) => e.authors)).size,
    };
  }

  music({ entries }: MusicInput): MusicAdvanced | null {
    if (!this.license.isActive()) return null;

    const artistCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();

    for (const e of entries) {
      for (const artist of e.artists) {
        artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
      }

      const type = e.albumType ?? "Autre";
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    }

    return {
      topArtists: toRankedList(artistCounts),
      releaseTypeSplit: toRankedList(typeCounts),
    };
  }

  // The heatmap and monthly/yearly bars span their natural range; only the
  // weekday and hourly curves respect `period`.

  async videoTemporal(
    userId: string,
    period: StatsWindow,
  ): Promise<VideoTemporalDto | null> {
    if (!this.license.isActive()) return null;

    const watches = await this.prisma.episodeWatch.findMany({
      // Filter in PostgreSQL because EpisodeWatch grows without bound.
      where: {
        userId,
        watchedAt: { not: null },
        episode: { season: { number: { not: 0 } } },
      },
      select: {
        watchedAt: true,
        episode: {
          select: {
            runtimeMin: true,
            season: {
              select: {
                mediaItem: { select: { type: true, runtimeMin: true } },
              },
            },
          },
        },
      },
    });

    // Runtime-wise a no-op — the `where` above already excluded these. Prisma
    // types `watchedAt` as nullable regardless of the filter, and this is
    // what narrows it for everything below.
    const regular = watches.filter(
      (w): w is (typeof watches)[number] & { watchedAt: Date } =>
        w.watchedAt !== null,
    );
    const now = new Date();
    const start = windowStart(period, now);
    const inWindow = start
      ? regular.filter((w) => w.watchedAt >= start)
      : regular;

    const datedMinutes = regular.map((w) => ({
      watchedAt: w.watchedAt,
      minutes: episodeRuntimeFor(
        w.episode.season.mediaItem.type,
        w.episode.runtimeMin,
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

  async social(userId: string): Promise<SocialStatsDto | null> {
    if (!this.license.isActive()) return null;

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
      // Two counts, not a row per list.
      this.prisma.list.groupBy({
        by: ["visibility"],
        where: { userId },
        _count: { _all: true },
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
      listsWritten: sumCounts(lists),
      listsPublicCount: sumCounts(
        lists.filter((l) => l.visibility === "PUBLIC"),
      ),
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

/** Totals a Prisma groupBy result's `_count._all` buckets. */
function sumCounts(groups: { _count: { _all: number } }[]): number {
  return groups.reduce((sum, g) => sum + g._count._all, 0);
}
