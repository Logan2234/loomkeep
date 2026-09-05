import {
  type AchievementDto,
  Domain,
  ErrorCode,
  type ListVisibility,
  ProfileAccess,
  type ProfileActivityStatsDto,
  type ProfileDomainStatDto,
  type ReviewVisibility,
  type SocialProfileDto,
  type UserSummaryDto,
  VisibilityFacet,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../common/app.exception";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { ACHIEVEMENTS } from "../gamification/achievements/registry";
import { isGamificationEnabled } from "../gamification/gamification.config";
import { PrismaService } from "../prisma/prisma.service";
import { runtimeFor } from "../stats/video-stats.util";
import {
  computeHeatmap,
  computeStreak,
  computeYearlyMinutes,
  mostActiveYear,
} from "../stats/video-temporal.util";
import { avatarUrl } from "../users/avatar.util";
import { FollowService } from "./follow.service";
import { earliest, latest } from "./profile-stats.util";
import { SOCIAL_DOMAINS } from "./social.constants";
import { VisibilityService } from "./visibility.service";
import {
  resolveFacet,
  resolveOwnVisibility,
  resolveProfileVisibility,
  type ViewerRelation,
} from "./visibility.util";

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
    private readonly config: ConfigService,
    private readonly flags: FeatureFlagsService,
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
        avatarUpdatedAt: true,
        hideProgression: true,
        equippedBadgeKeys: true,
      },
    });
    if (!target)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SocialUserNotFound,
      );

    const relation = await this.visibility.getRelation(viewerId, target);
    const visibility = resolveProfileVisibility(target.profileAccess, relation);

    if (visibility === "hidden") {
      // GHOST or a block in either direction: the profile must not exist.
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SocialUserNotFound,
      );
    }

    if (visibility === "locked") {
      // PRIVATE stranger: expose identity + the follow-request affordance only.
      // No content (bio, counts, library) ever leaves the server here.
      return {
        id: target.id,
        username: target.username,
        displayName: target.displayName,
        avatarUrl: avatarUrl(target),
        bio: null,
        profileAccess: target.profileAccess as ProfileAccess,
        createdAt: target.createdAt.toISOString(),
        followerCount: 0,
        followingCount: 0,
        relationship: this.visibility.toRelationshipDto(relation),
        domains: [],
        activityStats: EMPTY_ACTIVITY_STATS,
        xp: null,
        equippedBadges: [],
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

    // Same gate as activityStats — the owner always sees their real
    // progress; anyone else needs both the ACTIVITY facet visible and the
    // target's own `hideProgression` preference off. `UserScore` is only
    // read when gamification is actually on, so a self-hoster running with
    // it off never pays that query.
    const gamificationEnabled = isGamificationEnabled(this.config, this.flags);
    const xpVisible =
      relation.isSelf || (activityVisible && !target.hideProgression);

    const [
      activityStats,
      xp,
      equippedBadges,
      reviewsCount,
      commentsCount,
      listsCount,
    ] = await Promise.all([
      this.computeActivityStats(target.id, activityVisible),
      gamificationEnabled && xpVisible
        ? this.fetchRealXp(target.id)
        : Promise.resolve(null),
      gamificationEnabled && xpVisible
        ? this.fetchEquippedBadges(target.id, target.equippedBadgeKeys)
        : Promise.resolve([]),
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
      avatarUrl: avatarUrl(target),
      bio: target.bio,
      profileAccess: target.profileAccess as ProfileAccess,
      createdAt: target.createdAt.toISOString(),
      followerCount,
      followingCount,
      relationship: this.visibility.toRelationshipDto(relation),
      domains,
      activityStats,
      xp,
      equippedBadges,
      reviewsCount,
      commentsCount,
      listsCount,
      locked: false,
    };
  }

  /** A user's total XP, or 0 if they have no `UserScore` row yet (see `fetchXpByUser`). */
  private async fetchRealXp(userId: string): Promise<number> {
    const score = await this.prisma.userScore.findUnique({
      where: { userId },
    });
    return score?.xp ?? 0;
  }

  /**
   * [G9] Projects the target's equipped keys into full `AchievementDto`s for
   * the profile showcase. A key with no matching `UserAchievement` row (the
   * unlock was somehow reversed, or the registry entry no longer exists) is
   * dropped rather than shown half-populated — equipping already guarantees
   * "unlocked and not secret" at write time, this is just re-deriving the
   * display shape, not re-validating the business rule.
   */
  private async fetchEquippedBadges(
    userId: string,
    keys: string[],
  ): Promise<AchievementDto[]> {
    if (keys.length === 0) return [];

    const rows = await this.prisma.userAchievement.findMany({
      where: { userId, key: { in: keys } },
      select: { key: true, unlockedAt: true },
    });
    const unlockedAtByKey = new Map(rows.map((r) => [r.key, r.unlockedAt]));

    return keys.flatMap((key): AchievementDto[] => {
      const definition = ACHIEVEMENTS[key];
      const unlockedAt = unlockedAtByKey.get(key);
      if (!definition || !unlockedAt) return [];

      return [
        {
          key: definition.key,
          family: definition.family,
          tierOf: definition.tierOf ?? null,
          tier: definition.tier ?? null,
          xpAward: definition.xpAward,
          secret: false,
          unlocked: true,
          unlockedAt: unlockedAt.toISOString(),
          progress: null,
          equipped: true,
        },
      ];
    });
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
    if (!target)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SocialUserNotFound,
      );

    const relation = await this.visibility.getRelation(viewerId, target);
    const visibility = resolveProfileVisibility(target.profileAccess, relation);
    if (visibility === "hidden")
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SocialUserNotFound,
      );
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
    if (!target)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SocialUserNotFound,
      );

    const relation = await this.visibility.getRelation(viewerId, target);
    const visibility = resolveProfileVisibility(target.profileAccess, relation);
    if (visibility === "hidden")
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SocialUserNotFound,
      );
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
      firstActivityAt: earliest(firstTimestamps)?.toISOString() ?? null,
      lastActivityAt: latest(lastTimestamps)?.toISOString() ?? null,
      totalMinutes,
      mostActiveYear: mostActiveYear(computeYearlyMinutes(datedMinutes)),
      topGenres,
      heatmap: computeHeatmap(watchDates, 90, now),
    };
  }
}
