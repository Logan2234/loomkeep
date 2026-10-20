import {
  Domain,
  VisibilityFacet,
  type EntryStatus,
  type ListItemTargetType,
  type MediaType,
  type ProfileAccess,
  type VisibilityAudience,
  type WorkFriendsDto,
  type WorkProgressDto,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { deriveStatus, normalizeAiringFinished } from "../library/status.util";
import { PrismaService } from "../prisma/prisma.service";
import { toUserSummaryDto } from "../users/avatar.util";
import { isSuspended } from "../users/suspension.util";
import { FollowService } from "./follow.service";
import {
  DEFAULT_FACET_AUDIENCE,
  resolveFacet,
  resolveReviewVisibility,
  type ViewerRelation,
} from "./visibility.util";

const DOMAIN_OF: Record<ListItemTargetType, Domain> = {
  MEDIA: Domain.MEDIA,
  GAME: Domain.GAMES,
  BOOK: Domain.BOOKS,
  MUSIC: Domain.MUSIC,
};

/** Everyone listed is a friend: the relation every visibility rule reads. */
const FRIEND: ViewerRelation = {
  isSelf: false,
  following: true,
  requested: false,
  followsYou: true,
  isFriend: true,
  blocking: false,
  blockedByTarget: false,
};

const EPISODE_KEY = 10_000;

type Progress = Omit<WorkProgressDto, "updatedAt"> & { updatedAt: Date };

const blank = (status: string, updatedAt: Date): Progress => ({
  status,
  season: null,
  episode: null,
  page: null,
  pageCount: null,
  playtimeMinutes: null,
  updatedAt,
});

/**
 * The friends who track a work, for its page: each where their library
 * visibility lets the viewer see them, with their progress and, when they
 * published one the viewer may read, their review's rating.
 */
@Injectable()
export class WorkFriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly follow: FollowService,
  ) {}

  async forWork(
    viewerId: string,
    type: ListItemTargetType,
    itemId: string,
  ): Promise<WorkFriendsDto> {
    const friends = await this.sharingLibrary(
      await this.follow.listFriendIds(viewerId),
      DOMAIN_OF[type],
    );
    const { byUser, seasons } = await this.progress(type, itemId, [
      viewerId,
      ...friends.map((f) => f.id),
    ]);
    const tracking = friends.filter((f) => byUser.has(f.id));
    const ratings = await this.ratings(type, itemId, tracking);

    return {
      friends: tracking
        .map((f) => ({
          user: toUserSummaryDto(f),
          ...iso(byUser.get(f.id)!),
          rating: ratings.get(f.id) ?? null,
        }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      me: byUser.has(viewerId) ? iso(byUser.get(viewerId)!) : null,
      seasons,
    };
  }

  /**
   * Among `ids`, the viewer's friends whose library in `domain` the viewer
   * may see — what Messages' /saga and /pick read of the other members.
   */
  async friendsSharingLibrary(viewerId: string, ids: string[], domain: Domain) {
    const friends = new Set(await this.follow.listFriendIds(viewerId));
    return this.sharingLibrary(
      ids.filter((id) => friends.has(id)),
      domain,
    );
  }

  /** The friends whose library facet for `domain` the viewer may see. */
  private async sharingLibrary(ids: string[], domain: Domain) {
    if (ids.length === 0) return [];

    const [users, settings] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          username: true,
          displayName: true,
          profileAccess: true,
          avatarUpdatedAt: true,
          suspendedUntil: true,
        },
      }),
      this.prisma.visibilitySetting.findMany({
        where: {
          userId: { in: ids },
          domain,
          facet: VisibilityFacet.LIBRARY,
        },
        select: { userId: true, audience: true },
      }),
    ]);
    const audience = new Map(
      settings.map((s) => [s.userId, s.audience as VisibilityAudience]),
    );

    return users.filter(
      (u) =>
        !isSuspended(u) &&
        resolveFacet(
          u.profileAccess,
          audience.get(u.id) ?? DEFAULT_FACET_AUDIENCE,
          FRIEND,
        ),
    );
  }

  private async progress(
    type: ListItemTargetType,
    itemId: string,
    userIds: string[],
  ): Promise<{ byUser: Map<string, Progress>; seasons: number[] }> {
    switch (type) {
      case "MEDIA":
        return this.mediaProgress(itemId, userIds);

      case "GAME": {
        const rows = await this.prisma.gameEntry.findMany({
          where: { gameItemId: itemId, userId: { in: userIds } },
          select: {
            userId: true,
            status: true,
            playtimeMinutes: true,
            updatedAt: true,
          },
        });
        return {
          byUser: new Map(
            rows.map((r) => [
              r.userId,
              {
                ...blank(r.status, r.updatedAt),
                playtimeMinutes: r.playtimeMinutes || null,
              },
            ]),
          ),
          seasons: [],
        };
      }

      case "BOOK": {
        const rows = await this.prisma.bookEntry.findMany({
          where: { bookItemId: itemId, userId: { in: userIds } },
          select: {
            userId: true,
            status: true,
            currentPage: true,
            referencePageCount: true,
            updatedAt: true,
            bookItem: { select: { pageCount: true } },
          },
        });
        return {
          byUser: new Map(
            rows.map((r) => [
              r.userId,
              {
                ...blank(r.status, r.updatedAt),
                page: r.currentPage || null,
                pageCount: r.referencePageCount ?? r.bookItem.pageCount,
              },
            ]),
          ),
          seasons: [],
        };
      }

      case "MUSIC": {
        const rows = await this.prisma.musicEntry.findMany({
          where: { musicItemId: itemId, userId: { in: userIds } },
          select: { userId: true, status: true, updatedAt: true },
        });
        return {
          byUser: new Map(
            rows.map((r) => [r.userId, blank(r.status, r.updatedAt)]),
          ),
          seasons: [],
        };
      }
    }
  }

  /**
   * A series' status is derived from the episodes seen, as the library shows
   * it — never the stored column alone.
   */
  private async mediaProgress(itemId: string, userIds: string[]) {
    const [item, entries] = await Promise.all([
      this.prisma.mediaItem.findUnique({
        where: { id: itemId },
        select: { type: true, status: true },
      }),
      this.prisma.libraryEntry.findMany({
        where: { mediaItemId: itemId, userId: { in: userIds } },
        select: { userId: true, status: true, updatedAt: true },
      }),
    ]);
    const byUser = new Map<string, Progress>();
    if (!item || entries.length === 0) return { byUser, seasons: [] };

    const type = item.type as MediaType;

    if (type === "MOVIE") {
      for (const e of entries) {
        byUser.set(
          e.userId,
          blank(
            deriveStatus(type, null, false, e.status as EntryStatus),
            e.updatedAt,
          ),
        );
      }

      return { byUser, seasons: [] };
    }

    const [seasonRows, watchRows] = await Promise.all([
      this.prisma.$queryRaw<{ number: number; episodes: bigint }[]>`
        SELECT s.number, COUNT(e.id) AS episodes
        FROM "Season" s
        JOIN "Episode" e ON e."seasonId" = s.id
        WHERE s."mediaItemId" = ${itemId} AND s.number > 0
        GROUP BY s.number
        ORDER BY s.number
      `,
      this.prisma.$queryRaw<
        {
          userId: string;
          watched: bigint;
          furthest: number | null;
          lastWatchedAt: Date | null;
        }[]
      >`
        SELECT w."userId",
               COUNT(DISTINCT w."episodeId") AS watched,
               MAX(s.number * ${EPISODE_KEY} + e.number) AS furthest,
               MAX(w."watchedAt") AS "lastWatchedAt"
        FROM "EpisodeWatch" w
        JOIN "Episode" e ON e.id = w."episodeId"
        JOIN "Season" s ON s.id = e."seasonId"
        WHERE s."mediaItemId" = ${itemId}
          AND s.number > 0
          AND w."userId" = ANY(${entries.map((e) => e.userId)})
        GROUP BY w."userId"
      `,
    ]);
    const seasons = seasonRows.map((s) => Number(s.episodes));
    const total = seasons.reduce((sum, n) => sum + n, 0);
    const watches = new Map(watchRows.map((w) => [w.userId, w]));
    const airingFinished = normalizeAiringFinished(item.status);

    for (const e of entries) {
      const w = watches.get(e.userId);
      const furthest = w && w.furthest !== null ? Number(w.furthest) : null;
      const status = deriveStatus(
        type,
        total > 0
          ? {
              watchedEpisodes: Number(w?.watched ?? 0),
              totalEpisodes: total,
              nextEpisode: null,
            }
          : null,
        airingFinished,
        e.status as EntryStatus,
      );
      const updatedAt =
        w?.lastWatchedAt && w.lastWatchedAt > e.updatedAt
          ? w.lastWatchedAt
          : e.updatedAt;

      byUser.set(e.userId, {
        ...blank(status, updatedAt),
        season: furthest ? Math.floor(furthest / EPISODE_KEY) : null,
        episode: furthest ? furthest % EPISODE_KEY : null,
      });
    }

    return { byUser, seasons };
  }

  /** Ratings of the reviews these friends published for the viewer to read. */
  private async ratings(
    type: ListItemTargetType,
    itemId: string,
    friends: { id: string; profileAccess: ProfileAccess }[],
  ): Promise<Map<string, number>> {
    if (friends.length === 0) return new Map();

    const access = new Map(friends.map((f) => [f.id, f.profileAccess]));
    const reviews = await this.prisma.review.findMany({
      where: {
        targetType: type,
        targetId: itemId,
        userId: { in: [...access.keys()] },
      },
      select: { userId: true, rating: true, visibility: true },
    });

    return new Map(
      reviews
        .filter((r) =>
          resolveReviewVisibility(r.visibility, access.get(r.userId!)!, FRIEND),
        )
        .map((r) => [r.userId!, r.rating]),
    );
  }
}

const iso = (p: Progress): WorkProgressDto => ({
  ...p,
  updatedAt: p.updatedAt.toISOString(),
});
