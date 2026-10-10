import {
  type AchievementDto,
  type ConnectionDto,
  Domain,
  episodeRuntimeFor,
  ErrorCode,
  type ListVisibility,
  ProfileAccess,
  type ProfileActivityStatsDto,
  type ProfileDomainStatDto,
  type ReviewVisibility,
  type SocialProfileDto,
  VisibilityFacet,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../common/app.exception";
import { ACHIEVEMENTS } from "../gamification/achievements/registry";
import { isGamificationEnabled } from "../gamification/gamification.config";
import { PrismaService } from "../prisma/prisma.service";
import {
  computeHeatmap,
  computeStreak,
  computeYearlyMinutes,
  isStreakSecuredToday,
  mostActiveYear,
} from "../stats/video-temporal.util";
import { avatarUrl } from "../users/avatar.util";
import { isSuspended } from "../users/suspension.util";
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

/** The domains with dated activity feeding the profile's activity stats. */
const ACTIVITY_STATS_DOMAINS: Domain[] = [
  Domain.MEDIA,
  Domain.GAMES,
  Domain.BOOKS,
];

const EMPTY_ACTIVITY_STATS: ProfileActivityStatsDto = {
  visible: false,
  streakDays: 0,
  streakSecuredToday: false,
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
        suspendedUntil: true,
      },
    });
    if (!target || isSuspended(target))
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.UserNotFound);

    const relation = await this.visibility.getRelation(viewerId, target);
    const visibility = resolveProfileVisibility(target.profileAccess, relation);

    if (visibility === "hidden") {
      // GHOST or a block in either direction: the profile must not exist.
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.UserNotFound);
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

    // Each domain's Activité facet gates its own share of the stats (a game
    // session never reaches the heatmap through a public video facet).
    const activityVisibleFor = (domain: Domain) =>
      resolveFacet(
        target.profileAccess,
        this.visibility.audienceFor(settings, domain, VisibilityFacet.ACTIVITY),
        relation,
      );
    const statsDomains = new Set(
      ACTIVITY_STATS_DOMAINS.filter((domain) => activityVisibleFor(domain)),
    );

    // The owner always sees their real progress; anyone else needs both
    // the MEDIA Activité facet visible and the target's own
    // `hideProgression` preference off. `UserScore` is only
    // read when gamification is actually on, so a self-hoster running with
    // it off never pays that query.
    const gamificationEnabled = isGamificationEnabled(this.config);
    const xpVisible =
      relation.isSelf ||
      (activityVisibleFor(Domain.MEDIA) && !target.hideProgression);

    const [
      activityStats,
      xp,
      equippedBadges,
      reviewsCount,
      commentsCount,
      listsCount,
    ] = await Promise.all([
      this.computeActivityStats(target.id, statsDomains),
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
   * Projects the target's equipped keys into full `AchievementDto`s for
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
          // Shown on the achievements screen only, not in a showcase.
          rarity: null,
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
      select: { id: true, profileAccess: true, suspendedUntil: true },
    });
    if (!target || isSuspended(target))
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.UserNotFound);

    const relation = await this.visibility.getRelation(viewerId, target);
    const visibility = resolveProfileVisibility(target.profileAccess, relation);
    if (visibility === "hidden")
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.UserNotFound);
    if (visibility === "locked") return null;
    return target;
  }

  /**
   * The id of a profile the viewer may report: anything they can reach, a
   * locked private preview included (its name and photo are on show). 404s
   * when the profile must stay hidden.
   */
  async reportTargetId(viewerId: string, username: string): Promise<string> {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, profileAccess: true, suspendedUntil: true },
    });
    if (!target || isSuspended(target))
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.UserNotFound);

    const relation = await this.visibility.getRelation(viewerId, target);
    if (resolveProfileVisibility(target.profileAccess, relation) === "hidden")
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.UserNotFound);
    return target.id;
  }

  /**
   * A user's followers, gated the same way as their profile content: hidden
   * for GHOST/blocked, empty for a locked private stranger, full list
   * otherwise (public, self, or an accepted friend of a private account).
   */
  async listFollowers(
    viewerId: string,
    username: string,
  ): Promise<ConnectionDto[]> {
    const targetId = await this.resolveConnectionsTarget(viewerId, username);
    if (!targetId) return [];
    const followers = await this.follow.listFollowers(targetId);
    return this.follow.withViewerRelation(viewerId, followers);
  }

  /** A user's followed accounts — same gating as {@link listFollowers}. */
  async listFollowing(
    viewerId: string,
    username: string,
  ): Promise<ConnectionDto[]> {
    const targetId = await this.resolveConnectionsTarget(viewerId, username);
    if (!targetId) return [];
    const following = await this.follow.listFollowing(targetId);
    return this.follow.withViewerRelation(viewerId, following);
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
      select: { id: true, profileAccess: true, suspendedUntil: true },
    });
    if (!target || isSuspended(target))
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.UserNotFound);

    const relation = await this.visibility.getRelation(viewerId, target);
    const visibility = resolveProfileVisibility(target.profileAccess, relation);
    if (visibility === "hidden")
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.UserNotFound);
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
   * Activity summary. The streak counts every dated watch, game session and
   * reading session and is shown whatever the facets say — a run of days
   * says nothing about what was watched, played or read. Everything else is
   * built only from the domains whose Activité facet the viewer passes
   * (`domains`): watch time, most active year and genres are video-only, and
   * the heatmap and first/last activity dates merge the visible domains.
   */
  private async computeActivityStats(
    userId: string,
    domains: ReadonlySet<Domain>,
  ): Promise<ProfileActivityStatsDto> {
    const [entries, watches, gameSessions, bookSessions] = await Promise.all([
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
              runtimeMin: true,
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
      this.prisma.gameSession.findMany({
        where: { gameEntry: { userId } },
        select: { occurredAt: true },
      }),
      this.prisma.bookSession.findMany({
        where: { bookEntry: { userId } },
        select: { occurredAt: true },
      }),
    ]);

    const regular = watches.filter((w) => w.episode.season.number !== 0);
    const datedRegular = regular.filter(
      (w): w is (typeof regular)[number] & { watchedAt: Date } =>
        w.watchedAt !== null,
    );
    const now = new Date();
    const datesByDomain = new Map<Domain, Date[]>([
      [Domain.MEDIA, datedRegular.map((w) => w.watchedAt)],
      [Domain.GAMES, gameSessions.map((session) => session.occurredAt)],
      [Domain.BOOKS, bookSessions.map((session) => session.occurredAt)],
    ]);
    const allDates = [...datesByDomain.values()].flat();
    const streak = {
      streakDays: computeStreak(allDates, now),
      streakSecuredToday: isStreakSecuredToday(allDates, now),
    };

    if (domains.size === 0) return { ...EMPTY_ACTIVITY_STATS, ...streak };

    const activityDates = [...datesByDomain.entries()].flatMap(
      ([domain, dates]) => (domains.has(domain) ? dates : []),
    );
    const mediaVisible = domains.has(Domain.MEDIA);

    const runtimeOf = (w: (typeof regular)[number]) =>
      episodeRuntimeFor(
        w.episode.season.mediaItem.type,
        w.episode.runtimeMin,
        w.episode.season.mediaItem.runtimeMin,
      );
    const totalMinutes = mediaVisible
      ? regular.reduce((sum, w) => sum + runtimeOf(w), 0)
      : 0;

    const genreCounts = new Map<string, number>();

    for (const e of mediaVisible ? entries : []) {
      for (const g of e.mediaItem.genres) {
        genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
      }
    }

    const topGenres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre, count]) => ({ label: genre, count }));

    const visibleEntries = mediaVisible ? entries : [];
    const firstTimestamps = [
      ...visibleEntries.map((e) => e.createdAt),
      ...activityDates,
    ];
    const lastTimestamps = [
      ...visibleEntries.map((e) => e.updatedAt),
      ...activityDates,
    ];

    return {
      visible: true,
      ...streak,
      firstActivityAt: earliest(firstTimestamps)?.toISOString() ?? null,
      lastActivityAt: latest(lastTimestamps)?.toISOString() ?? null,
      totalMinutes,
      mostActiveYear: mediaVisible
        ? mostActiveYear(
            computeYearlyMinutes(
              datedRegular.map((w) => ({
                watchedAt: w.watchedAt,
                minutes: runtimeOf(w),
              })),
            ),
          )
        : null,
      topGenres,
      heatmap: computeHeatmap(activityDates, 90, now),
    };
  }
}
