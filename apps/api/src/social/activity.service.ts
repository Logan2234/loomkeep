import {
  type ActivityActorDto,
  type ActivityDomain,
  type ActivityEventDto,
  type ActivityLevel,
  type ActivityType,
  type Domain,
  type ListVisibility,
  type PagedResult,
  type ProfileAccess,
  VisibilityFacet,
} from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { canonicalExternalId } from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";
import { avatarUrl } from "../users/avatar.util";
import { VisibilityService } from "./visibility.service";
import {
  resolveFacet,
  resolveOwnVisibility,
  type ViewerRelation,
} from "./visibility.util";

/** Aggregatable event types: consecutive same-type/same-target events collapse into one, counted. */
const AGGREGATABLE_TYPES = new Set(["PROGRESS", "LIST_ITEM_ADDED"]);

/** What a domain service passes to record an activity event. */
export interface EmitActivityInput {
  userId: string;
  type: ActivityType;
  domain: ActivityDomain;
  /** "MEDIA" | "GAME" | "BOOK" | "MUSIC" | "LIST". */
  targetType: string;
  /** Internal catalogue item id (MediaItem/GameItem/BookItem/MusicItem/List). */
  targetId: string;
  level?: ActivityLevel;
  /** Whether it surfaces on followers' home feed (matrix milestone). */
  homeFeed?: boolean;
  data?: Record<string, unknown>;
}

type EventRow = {
  id: string;
  userId: string;
  type: string;
  domain: string;
  targetType: string;
  targetId: string;
  level: string;
  title: string;
  imageUrl: string | null;
  href: string | null;
  data: Prisma.JsonValue;
  createdAt: Date;
};

export const FEED_PAGE_SIZE = 30;
const PREVIEW_SIZE = 6;

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
  ) {}

  /**
   * Records an activity event. Resolves the target's display snapshot itself so
   * callers stay thin. Best-effort: a feed-write failure never breaks the user
   * action that triggered it, so this swallows and logs its own errors.
   */
  async emit(input: EmitActivityInput): Promise<void> {
    try {
      const snap = await this.resolveSnapshot(input.targetType, input.targetId);
      if (!snap) return;

      await this.prisma.activityEvent.create({
        data: {
          userId: input.userId,
          type: input.type,
          domain: input.domain,
          targetType: input.targetType,
          targetId: input.targetId,
          level: input.level ?? "WORK",
          homeFeed: input.homeFeed ?? false,
          title: snap.title,
          imageUrl: snap.imageUrl,
          href: snap.href,
          data: (input.data ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to emit ${input.type} activity for user ${input.userId}`,
        err,
      );
    }
  }

  /**
   * The home feed: recent `homeFeed` milestones from the users the viewer
   * follows, gated by each actor's Activité audience, aggregated and paginated.
   */
  async homeFeed(
    viewerId: string,
    page = 1,
    limit = FEED_PAGE_SIZE,
  ): Promise<PagedResult<ActivityEventDto>> {
    const followeeIds = await this.followeeIds(viewerId);
    if (followeeIds.length === 0) return { items: [], hasMore: false };

    const rows = await this.prisma.activityEvent.findMany({
      where: {
        userId: { in: followeeIds },
        homeFeed: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit + 1,
    });

    return this.buildFeed(viewerId, rows, limit);
  }

  /** A short home-page teaser of the home feed. */
  async homePreview(viewerId: string): Promise<ActivityEventDto[]> {
    const feed = await this.homeFeed(viewerId, 1, PREVIEW_SIZE);
    return feed.items;
  }

  /**
   * A user's profile timeline: everything they did that the viewer may see,
   * filtered per-domain by the actor's Activité audience. The caller has already
   * checked the profile is reachable at all.
   */
  async profileTimeline(
    viewerId: string,
    target: { id: string; profileAccess: string },
    page = 1,
    limit = FEED_PAGE_SIZE,
  ): Promise<PagedResult<ActivityEventDto>> {
    const rows = await this.prisma.activityEvent.findMany({
      where: { userId: target.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit + 1,
    });

    return this.buildFeed(viewerId, rows, limit);
  }

  // --- internals -----------------------------------------------------------

  private async followeeIds(viewerId: string): Promise<string[]> {
    const follows = await this.prisma.follow.findMany({
      where: { followerId: viewerId, status: "ACCEPTED" },
      select: { followeeId: true },
    });
    return follows.map((f) => f.followeeId);
  }

  /**
   * Shared feed builder: visibility-gates the raw rows against each actor's
   * Activité audience, aggregates binges, hydrates the actor, and paginates.
   */
  private async buildFeed(
    viewerId: string,
    rows: EventRow[],
    limit: number,
  ): Promise<PagedResult<ActivityEventDto>> {
    const visible = await this.filterVisible(viewerId, rows);
    const hasMore = visible.length > limit;
    const page = visible.slice(0, limit);

    const actors = await this.actors(page.map((e) => e.userId));
    const aggregated = aggregate(page);

    const items: ActivityEventDto[] = aggregated.map((e) => ({
      id: e.id,
      type: e.type as ActivityType,
      domain: e.domain as ActivityDomain,
      targetType: e.targetType,
      level: e.level as ActivityLevel,
      title: e.title,
      imageUrl: e.imageUrl,
      href: e.href,
      data: (e.data ?? {}) as Record<string, unknown>,
      createdAt: e.createdAt.toISOString(),
      actor: actors.get(e.userId) ?? {
        username: "",
        displayName: "",
        avatarUrl: null,
      },
      count: e.count,
    }));

    return { items, hasMore };
  }

  /**
   * Keeps only events the viewer may see. Two gates depending on the event's
   * target: a `"LIST"` event's visibility is its own explicit field (own-scope
   * pattern, like Review — never facet-derived, see `resolveOwnVisibility`);
   * everything else is gated by the actor's per-domain Activité facet as
   * before. Relation/settings are resolved once per actor and reused across
   * their events (a feed page spans few actors).
   */
  private async filterVisible(
    viewerId: string,
    rows: EventRow[],
  ): Promise<EventRow[]> {
    const actorCache = new Map<
      string,
      { access: ProfileAccess; relation: ViewerRelation } | null
    >();
    const settingsCache = new Map<
      string,
      Awaited<ReturnType<VisibilityService["getSettingsMap"]>>
    >();

    const actorFor = async (actorId: string) => {
      const cached = actorCache.get(actorId);
      if (cached !== undefined) return cached;

      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { id: true, profileAccess: true },
      });

      if (!actor) {
        actorCache.set(actorId, null);
        return null;
      }

      const relation = await this.visibility.getRelation(viewerId, actor);
      const entry = {
        access: actor.profileAccess as ProfileAccess,
        relation,
      };
      actorCache.set(actorId, entry);
      return entry;
    };

    const listIds = [
      ...new Set(
        rows.filter((r) => r.targetType === "LIST").map((r) => r.targetId),
      ),
    ];
    const listVisibility = listIds.length
      ? new Map(
          (
            await this.prisma.list.findMany({
              where: { id: { in: listIds } },
              select: { id: true, visibility: true },
            })
          ).map((l) => [l.id, l.visibility as ListVisibility]),
        )
      : new Map<string, ListVisibility>();

    const kept: EventRow[] = [];

    for (const row of rows) {
      const actor = await actorFor(row.userId);
      if (!actor) continue;

      if (row.targetType === "LIST") {
        const listVis = listVisibility.get(row.targetId);

        if (
          listVis &&
          resolveOwnVisibility(listVis, actor.access, actor.relation)
        ) {
          kept.push(row);
        }

        continue;
      }

      let settings = settingsCache.get(row.userId);

      if (!settings) {
        settings = await this.visibility.getSettingsMap(row.userId);
        settingsCache.set(row.userId, settings);
      }

      const ok = resolveFacet(
        actor.access,
        this.visibility.audienceFor(
          settings,
          row.domain as Domain,
          VisibilityFacet.ACTIVITY,
        ),
        actor.relation,
      );
      if (ok) kept.push(row);
    }

    return kept;
  }

  private async actors(ids: string[]): Promise<Map<string, ActivityActorDto>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUpdatedAt: true,
      },
    });
    return new Map(
      users.map((u) => [
        u.id,
        {
          username: u.username,
          displayName: u.displayName,
          avatarUrl: avatarUrl(u),
        },
      ]),
    );
  }

  /** Resolves a work's title/image/detail-link from its internal id. */
  private async resolveSnapshot(
    targetType: string,
    targetId: string,
  ): Promise<{
    title: string;
    imageUrl: string | null;
    href: string | null;
  } | null> {
    const withIds = {
      canonicalSource: true,
      externalIds: { select: { source: true, externalId: true } },
    } as const;

    switch (targetType) {
      case "MEDIA": {
        const i = await this.prisma.mediaItem.findUnique({
          where: { id: targetId },
          select: { title: true, posterUrl: true, type: true, ...withIds },
        });
        if (!i) return null;
        const src = canonicalExternalId(i, i.externalIds);
        return {
          title: i.title,
          imageUrl: i.posterUrl,
          href: src ? `/app/media/${i.type.toLowerCase()}/${src}` : null,
        };
      }

      case "GAME": {
        const i = await this.prisma.gameItem.findUnique({
          where: { id: targetId },
          select: { title: true, coverUrl: true, ...withIds },
        });
        if (!i) return null;
        const src = canonicalExternalId(i, i.externalIds);
        return {
          title: i.title,
          imageUrl: i.coverUrl,
          href: src ? `/app/games/${src}` : null,
        };
      }

      case "BOOK": {
        const i = await this.prisma.bookItem.findUnique({
          where: { id: targetId },
          select: { title: true, coverUrl: true, ...withIds },
        });
        if (!i) return null;
        const src = canonicalExternalId(i, i.externalIds);
        return {
          title: i.title,
          imageUrl: i.coverUrl,
          href: src ? `/app/books/${src}` : null,
        };
      }

      case "MUSIC": {
        const i = await this.prisma.musicItem.findUnique({
          where: { id: targetId },
          select: { title: true, coverUrl: true, ...withIds },
        });
        if (!i) return null;
        const src = canonicalExternalId(i, i.externalIds);
        return {
          title: i.title,
          imageUrl: i.coverUrl,
          href: src ? `/app/music/${src}` : null,
        };
      }

      case "LIST": {
        const i = await this.prisma.list.findUnique({
          where: { id: targetId },
          select: { title: true },
        });
        if (!i) return null;
        // No cover resolution here (would need a cross-domain item lookup) —
        // list previews elsewhere (ListService.listEditable/listForUser) resolve
        // their own cover; the feed row just needs the title + link.
        return {
          title: i.title,
          imageUrl: null,
          href: `/app/lists/${targetId}`,
        };
      }

      default:
        return null;
    }
  }
}

/**
 * Collapses consecutive same-type events on the same target into one,
 * counted — a PROGRESS binge or several LIST_ITEM_ADDED in a row.
 */
function aggregate(rows: EventRow[]): (EventRow & { count: number })[] {
  const out: (EventRow & { count: number })[] = [];

  for (const row of rows) {
    const last = out[out.length - 1];

    if (
      last &&
      last.type === row.type &&
      AGGREGATABLE_TYPES.has(row.type) &&
      last.userId === row.userId &&
      last.targetId === row.targetId
    ) {
      last.count += 1;
      continue;
    }

    out.push({ ...row, count: 1 });
  }

  return out;
}
