import type {
  AdminSocialActivityTrendDto,
  AdminSocialSectionDto,
  AdminSocialStatsDto,
  ReportCategory,
  TrendPeriod,
} from "@loomkeep/shared";
import { FollowStatus, ReportStatus, ReviewVoteValue } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { PrismaService } from "../prisma/prisma.service";
import { isSocialEnabled } from "../social/social.config";
import {
  computeAverageRating,
  computeRatingDistribution,
} from "../stats/rating-distribution.util";
import { percent } from "./admin-catalogue-stats.util";
import {
  contributorIds,
  foundedPercent,
  medianResolutionHours,
  rankByCategory,
  rankContributors,
  type ContributionCounts,
} from "./admin-social-stats.util";
import { bucketize, trendBucketStarts } from "./admin-stats.util";

/** Default bucket size of the "Activité sociale" card before the user picks one. */
const DEFAULT_PERIOD: TrendPeriod = "week";

/**
 * "Social" section of /admin/stats.
 *
 * SOCIAL_ENABLED is read as data, not as a guard: the section is one block of
 * an admin page whose other sections must keep rendering, so a disabled
 * instance gets `{ enabled: false }` instead of the 404 `SocialFeatureGuard`
 * throws on genuine social routes.
 */
@Injectable()
export class AdminSocialStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly flags: FeatureFlagsService,
  ) {}

  async getSection(): Promise<AdminSocialSectionDto> {
    if (!isSocialEnabled(this.config, this.flags)) return { enabled: false };
    return { enabled: true, ...(await this.getStats()) };
  }

  private async getStats(): Promise<AdminSocialStatsDto> {
    const now = new Date();
    const [totals, activity, reports, ratings, contribution] =
      await Promise.all([
        this.totals(),
        this.getActivityTrend(DEFAULT_PERIOD, now),
        this.reports(),
        this.ratings(),
        this.contribution(),
      ]);

    return {
      generatedAt: now.toISOString(),
      totals,
      activity,
      reports,
      ratings,
      ...contribution,
    };
  }

  /** Reviews + comments created per bucket — the card's period picker re-queries this alone. */
  async getActivityTrend(
    period: TrendPeriod,
    now = new Date(),
  ): Promise<AdminSocialActivityTrendDto> {
    const starts = trendBucketStarts(period, now);
    const since = { gte: starts[0] };

    const [reviews, comments] = await Promise.all([
      this.prisma.review.findMany({
        where: { createdAt: since },
        select: { createdAt: true },
      }),
      // Tombstones stay in the curve: they *were* written, and dropping them
      // would rewrite the past every time a comment is deleted.
      this.prisma.comment.findMany({
        where: { createdAt: since },
        select: { createdAt: true },
      }),
    ]);

    const points = bucketize(
      [...reviews.map((r) => r.createdAt), ...comments.map((c) => c.createdAt)],
      starts,
    );

    return {
      period,
      points,
      total: points.reduce((sum, p) => sum + p.count, 0),
    };
  }

  private async totals(): Promise<AdminSocialStatsDto["totals"]> {
    const [
      reviews,
      comments,
      commentsEver,
      lists,
      follows,
      reactions,
      helpfulVotes,
      blocks,
    ] = await Promise.all([
      this.prisma.review.count(),
      this.prisma.comment.count({ where: { deletedAt: null } }),
      this.prisma.comment.count(),
      this.prisma.list.count(),
      this.prisma.follow.count({ where: { status: FollowStatus.ACCEPTED } }),
      this.prisma.commentReaction.count(),
      this.prisma.reviewVote.count({ where: { value: ReviewVoteValue.UP } }),
      this.prisma.block.count(),
    ]);

    return {
      reviews,
      comments,
      lists,
      follows,
      reactions,
      helpfulVotes,
      blocks,
      deletedCommentPercent: percent(commentsEver - comments, commentsEver),
    };
  }

  private async reports(): Promise<AdminSocialStatsDto["reports"]> {
    const [pending, resolved, dismissed, closed, byCategory] =
      await Promise.all([
        this.prisma.report.count({ where: { status: ReportStatus.PENDING } }),
        this.prisma.report.count({ where: { status: ReportStatus.RESOLVED } }),
        this.prisma.report.count({
          where: { status: ReportStatus.DISMISSED },
        }),
        this.prisma.report.findMany({
          where: { resolvedAt: { not: null } },
          select: { createdAt: true, resolvedAt: true },
        }),
        this.prisma.report.groupBy({
          by: ["category"],
          where: { category: { not: null } },
          _count: { _all: true },
        }),
      ]);

    return {
      pending,
      resolved,
      medianResolutionHours: medianResolutionHours(
        closed.map((r) => ({
          createdAt: r.createdAt,
          // Narrowed by the `not: null` filter above.
          resolvedAt: r.resolvedAt as Date,
        })),
      ),
      foundedPercent: foundedPercent(resolved, dismissed),
      byCategory: rankByCategory(
        new Map(
          byCategory.map((r) => [
            // Narrowed by the `not: null` filter above.
            r.category as ReportCategory,
            r._count._all,
          ]),
        ),
      ),
    };
  }

  /** Every review on the instance, all accounts — the instance's own taste curve. */
  private async ratings(): Promise<AdminSocialStatsDto["ratings"]> {
    const rows = await this.prisma.review.findMany({
      select: { rating: true },
    });
    const ratings = rows.map((r) => r.rating);

    return {
      distribution: computeRatingDistribution(ratings),
      average: computeAverageRating(ratings),
      total: ratings.length,
    };
  }

  /**
   * Who writes and who only reads. The denominator is every account on the
   * instance: there is no stored notion of "socially active" account to narrow
   * it to (`enabledDomains` is about media domains, not about the social
   * surface), so a narrower split would be an invented one.
   */
  private async contribution(): Promise<
    Pick<AdminSocialStatsDto, "topContributors" | "contributors" | "readers">
  > {
    const [accounts, reviewRows, commentRows] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.review.groupBy({ by: ["userId"], _count: { _all: true } }),
      this.prisma.comment.groupBy({
        by: ["authorId"],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    // Reviews/comments from a deleted account (userId/authorId SetNull)
    // aren't attributable to anyone, so they're excluded from contribution
    // rankings.
    const counts: ContributionCounts = {
      reviews: new Map(
        reviewRows
          .filter((r) => r.userId !== null)
          .map((r) => [r.userId as string, r._count._all]),
      ),
      comments: new Map(
        commentRows
          .filter((c) => c.authorId !== null)
          .map((c) => [c.authorId as string, c._count._all]),
      ),
    };

    const contributors = contributorIds(counts);
    const usernames = await this.prisma.user.findMany({
      where: { id: { in: [...contributors] } },
      select: { id: true, username: true },
    });

    return {
      topContributors: rankContributors(
        counts,
        new Map(usernames.map((u) => [u.id, u.username])),
      ),
      contributors: contributors.size,
      readers: Math.max(0, accounts - contributors.size),
    };
  }
}
