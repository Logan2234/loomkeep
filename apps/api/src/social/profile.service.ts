import { Injectable, NotFoundException } from "@nestjs/common";
import {
  Domain,
  type ListVisibility,
  type ProfileActivityStatsDto,
  type ProfileDomainStatDto,
  ProfileAccess,
  type ReviewVisibility,
  type SocialProfileDto,
  type UserSummaryDto,
  VisibilityFacet,
} from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import { runtimeFor } from "../stats/video-stats.util";
import {
  computeHeatmap,
  computeStreak,
  computeYearlyMinutes,
  mostActiveYear,
} from "../stats/video-temporal.util";
import { FollowService } from "./follow.service";
import { SOCIAL_DOMAINS } from "./social.constants";
import {
  resolveFacet,
  resolveOwnVisibility,
  resolveProfileVisibility,
  type ViewerRelation,
} from "./visibility.util";
import { VisibilityService } from "./visibility.service";

const EMPTY_ACTIVITY_STATS: ProfileActivityStatsDto = {
  visible: false,
  streakDays: 0,
  firstActivityAt: null,
  lastActivityAt: null,
  totalMinutes: 0,
  mostActiveYear: null,
  topGenres: [],
  heatmap: [],
};

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly follow: FollowService,
  ) {}

  /** Builds a user's profile as seen by `viewerId`, or 404 if not reachable. */
  async getProfile(
    viewerId: string,
    username: string,
  ): Promise<SocialProfileDto> {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        profileAccess: true,
        createdAt: true,
      },
    });
    if (!target) throw new NotFoundException();

    const relation = await this.visibility.getRelation(viewerId, target);
    const visibility = resolveProfileVisibility(target.profileAccess, relation);

    if (visibility === "hidden") {
      // GHOST or a block in either direction: the profile must not exist.
      throw new NotFoundException();
    }

    if (visibility === "locked") {
      // PRIVATE stranger: expose identity + the follow-request affordance only.
      // No content (bio, counts, library) ever leaves the server here.
      return {
        id: target.id,
        username: target.username,
        displayName: target.displayName,
        bio: null,
        profileAccess: target.profileAccess as ProfileAccess,
        createdAt: target.createdAt.toISOString(),
        followerCount: 0,
        followingCount: 0,
        relationship: this.visibility.toRelationshipDto(relation),
        domains: [],
        activityStats: EMPTY_ACTIVITY_STATS,
        reviewsCount: 0,
        commentsCount: 0,
        listsCount: 0,
        locked: true,
      };
    }

    const [followerCount, followingCount, settings] = await Promise.all([
      this.prisma.follow.count({
        where: { followeeId: target.id, status: "ACCEPTED" },
      }),
      this.prisma.follow.count({
        where: { followerId: target.id, status: "ACCEPTED" },
      }),
      this.visibility.getSettingsMap(target.id),
    ]);

    const domains: ProfileDomainStatDto[] = [];

    for (const domain of SOCIAL_DOMAINS) {
      const audience = this.visibility.audienceFor(
        settings,
        domain,
        VisibilityFacet.LIBRARY,
      );
      const visible = resolveFacet(target.profileAccess, audience, relation);
      const [count, favorites] = visible
        ? await Promise.all([
            this.countLibrary(target.id, domain),
            this.countFavorites(target.id, domain),
          ])
        : [0, 0];
      domains.push({ domain, visible, count, favorites });
    }

    const activityVisible = resolveFacet(
      target.profileAccess,
      this.visibility.audienceFor(
        settings,
        Domain.MEDIA,
        VisibilityFacet.ACTIVITY,
      ),
      relation,
    );

    const [activityStats, reviewsCount, commentsCount, listsCount] =
      await Promise.all([
        this.computeActivityStats(target.id, activityVisible),
        this.countOwnVisible(
          this.prisma.review.findMany({
            where: { userId: target.id },
            select: { visibility: true },
          }),
          target.profileAccess,
          relation,
        ),
        this.prisma.comment.count({
          where: { authorId: target.id, deletedAt: null },
        }),
        this.countOwnVisible(
          this.prisma.list.findMany({
            where: { userId: target.id },
            select: { visibility: true },
          }),
          target.profileAccess,
          relation,
        ),
      ]);

    return {
      id: target.id,
      username: target.username,
      displayName: target.displayName,
      bio: target.bio,
      profileAccess: target.profileAccess as ProfileAccess,
      createdAt: target.createdAt.toISOString(),
      followerCount,
      followingCount,
      relationship: this.visibility.toRelationshipDto(relation),
      domains,
      activityStats,
      reviewsCount,
      commentsCount,
      listsCount,
      locked: false,
    };
  }

  /**
   * Resolves a profile for its activity timeline: the target `{ id,
   * profileAccess }` when the viewer may see its content, `null` when the
   * profile is only a locked preview (reachable identity, no content), and a
   * 404 when it must stay hidden (GHOST or a block).
   */
  async resolveTimelineTarget(
    viewerId: string,
    username: string,
  ): Promise<{ id: string; profileAccess: string } | null> {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, profileAccess: true },
    });
    if (!target) throw new NotFoundException();

    const relation = await this.visibility.getRelation(viewerId, target);
    const visibility = resolveProfileVisibility(target.profileAccess, relation);
    if (visibility === "hidden") throw new NotFoundException();
    if (visibility === "locked") return null;
    return target;
  }

  /**
   * A user's followers, gated the same way as their profile content: hidden
   * for GHOST/blocked, empty for a locked private stranger, full list
   * otherwise (public, self, or an accepted friend of a private account).
   */
  async listFollowers(
    viewerId: string,
    username: string,
  ): Promise<UserSummaryDto[]> {
    const targetId = await this.resolveConnectionsTarget(viewerId, username);
    return targetId ? this.follow.listFollowers(targetId) : [];
  }

  /** A user's followed accounts — same gating as {@link listFollowers}. */
  async listFollowing(
    viewerId: string,
    username: string,
  ): Promise<UserSummaryDto[]> {
    const targetId = await this.resolveConnectionsTarget(viewerId, username);
    return targetId ? this.follow.listFollowing(targetId) : [];
  }

  // Resolves `username` to an id the viewer may see the connections of, or
  // `null` when the profile is locked (empty list, not an error). 404s when
  // the profile must not be revealed to exist (GHOST/blocked).
  private async resolveConnectionsTarget(
    viewerId: string,
    username: string,
  ): Promise<string | null> {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, profileAccess: true },
    });
    if (!target) throw new NotFoundException();

    const relation = await this.visibility.getRelation(viewerId, target);
    const visibility = resolveProfileVisibility(target.profileAccess, relation);
    if (visibility === "hidden") throw new NotFoundException();
    if (visibility === "locked") return null;
    return target.id;
  }

  private countLibrary(userId: string, domain: Domain): Promise<number> {
    return this.countEntries(userId, domain, false);
  }

  private countFavorites(userId: string, domain: Domain): Promise<number> {
    return this.countEntries(userId, domain, true);
  }

  /** Entry count in one domain's own table — every domain has the same two columns. */
  private countEntries(
    userId: string,
    domain: Domain,
    favoritesOnly: boolean,
  ): Promise<number> {
    const where = favoritesOnly ? { userId, favorite: true } : { userId };

    switch (domain) {
      case Domain.MEDIA:
        return this.prisma.libraryEntry.count({ where });
      case Domain.GAMES:
        return this.prisma.gameEntry.count({ where });
      case Domain.BOOKS:
        return this.prisma.bookEntry.count({ where });
      case Domain.MUSIC:
        return this.prisma.musicEntry.count({ where });
      default:
        return Promise.resolve(0);
    }
  }

  // Counts rows carrying their own explicit visibility (Review/List) that
  // the viewer may see — same `resolveOwnVisibility` rule as their activity
  // feed entries.
  private async countOwnVisible(
    rows: Promise<{ visibility: ReviewVisibility | ListVisibility }[]>,
    access: ProfileAccess,
    relation: ViewerRelation,
  ): Promise<number> {
    return (await rows).filter((r) =>
      resolveOwnVisibility(r.visibility, access, relation),
    ).length;
  }

  /**
   * Video-derived activity summary (streak, heatmap teaser, genres…) —
   * deliberately video-only, since EpisodeWatch is the only true per-event
   * log in the app. Gated as one block by the caller via `visible`.
   */
  private async computeActivityStats(
    userId: string,
    visible: boolean,
  ): Promise<ProfileActivityStatsDto> {
    if (!visible) return EMPTY_ACTIVITY_STATS;

    const [entries, watches] = await Promise.all([
      this.prisma.libraryEntry.findMany({
        where: { userId },
        select: {
          createdAt: true,
          updatedAt: true,
          mediaItem: { select: { genres: true } },
        },
      }),
      this.prisma.episodeWatch.findMany({
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
      }),
    ]);

    const regular = watches.filter((w) => w.episode.season.number !== 0);
    const now = new Date();
    const watchDates = regular.map((w) => w.watchedAt);

    const datedMinutes = regular.map((w) => ({
      watchedAt: w.watchedAt,
      minutes: runtimeFor(
        w.episode.season.mediaItem.type,
        w.episode.season.mediaItem.runtimeMin,
      ),
    }));
    const totalMinutes = datedMinutes.reduce((sum, d) => sum + d.minutes, 0);

    const genreCounts = new Map<string, number>();

    for (const e of entries) {
      for (const g of e.mediaItem.genres) {
        genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
      }
    }

    const topGenres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre, count]) => ({ label: genre, count }));

    const firstTimestamps = [...entries.map((e) => e.createdAt), ...watchDates];
    const lastTimestamps = [...entries.map((e) => e.updatedAt), ...watchDates];

    return {
      visible: true,
      streakDays: computeStreak(watchDates, now),
      firstActivityAt:
        firstTimestamps.length > 0
          ? new Date(
              Math.min(...firstTimestamps.map((d) => d.getTime())),
            ).toISOString()
          : null,
      lastActivityAt:
        lastTimestamps.length > 0
          ? new Date(
              Math.max(...lastTimestamps.map((d) => d.getTime())),
            ).toISOString()
          : null,
      totalMinutes,
      mostActiveYear: mostActiveYear(computeYearlyMinutes(datedMinutes)),
      topGenres,
      heatmap: computeHeatmap(watchDates, 90, now),
    };
  }
}
