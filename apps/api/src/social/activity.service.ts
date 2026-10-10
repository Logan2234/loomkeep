import {
  VisibilityFacet,
  type ActivityActorDto,
  type ActivityDomain,
  type ActivityEventDto,
  type ActivityLevel,
  type ActivityType,
  type Domain,
  type ListVisibility,
  type PagedResult,
  type ProfileAccess,
  type ReviewTargetType,
  type ReviewVisibility,
} from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  CANONICAL_EXTERNAL_ID_SELECT,
  canonicalExternalId,
} from "../common/external-id.util";
import {
  parsePageQuery,
  toPagedResult,
  type ParsedPage,
} from "../common/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import { avatarUrl } from "../users/avatar.util";
import { DomainGateService } from "../users/domain-gate.service";
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
  sourceType?: string;
  sourceId?: string;
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
  sourceType?: string | null;
  sourceId?: string | null;
  createdAt: Date;
};

export const FEED_PAGE_SIZE = 30;

/**
 * Feed domains no user turns on or off, so the viewer's enabled domains can't
 * filter them out.
 */
const UNGATED_FEED_DOMAINS: ActivityDomain[] = ["LISTS"];

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly domainGate: DomainGateService,
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
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to emit ${input.type} activity for user ${input.userId}`,
        err,
      );
    }
  }

  async updateLinked(
    sourceType: string,
    sourceId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.activityEvent.updateMany({
        where: { sourceType, sourceId },
        data: { data: data as Prisma.InputJsonValue },
      });
    } catch (err) {
      this.logger.error(
        `Failed to update activity projection ${sourceType}/${sourceId}`,
        err,
      );
    }
  }

  async deleteLinked(sourceType: string, sourceId: string): Promise<void> {
    try {
      await this.prisma.activityEvent.deleteMany({
        where: { sourceType, sourceId },
      });
    } catch (err) {
      this.logger.error(
        `Failed to delete activity projection ${sourceType}/${sourceId}`,
        err,
      );
    }
  }

  /**
   * The home feed: recent `homeFeed` milestones from the users the viewer
   * follows, gated by each actor's Activité audience, aggregated and paginated.
   *
   * Only ever covers the domains the viewer keeps enabled — a domain they
   * turned off, or one under maintenance or premium-locked for them, stays out
   * of the feed as it stays out of the rest of the app. `domain` narrows it to
   * one of those.
   */
  async homeFeed(
    viewerId: string,
    page: ParsedPage = parsePageQuery(undefined, undefined, FEED_PAGE_SIZE),
    domain?: Domain,
  ): Promise<PagedResult<ActivityEventDto>> {
    const { skip, take, limit } = page;
    const enabled = await this.domainGate.getEnabledDomains(viewerId);

    if (domain && !enabled.includes(domain)) {
      return { items: [], hasMore: false };
    }

    const followeeIds = await this.followeeIds(viewerId);
    if (followeeIds.length === 0) return { items: [], hasMore: false };

    const domains: ActivityDomain[] = domain
      ? [domain]
      : [...enabled, ...UNGATED_FEED_DOMAINS];
    const rows = await this.prisma.activityEvent.findMany({
      where: {
        userId: { in: followeeIds },
        homeFeed: true,
        domain: { in: domains },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: take + 1,
    });

    return this.buildFeed(viewerId, rows, limit);
  }

  /**
   * A user's profile timeline: everything they did that the viewer may see,
   * filtered per-domain by the actor's Activité audience. The caller has already
   * checked the profile is reachable at all.
   */
  async profileTimeline(
    viewerId: string,
    target: { id: string; profileAccess: string },
    page: ParsedPage = parsePageQuery(undefined, undefined, FEED_PAGE_SIZE),
  ): Promise<PagedResult<ActivityEventDto>> {
    const { skip, take, limit } = page;
    const rows = await this.prisma.activityEvent.findMany({
      where: { userId: target.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: take + 1,
    });

    return this.buildFeed(viewerId, rows, limit);
  }

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
   *
   * `rows` is one page of raw events plus one extra, fetched with
   * `skip`/`take`. Pages are cut from raw events, so `hasMore` is read from
   * them before any are hidden: reading it after the visibility filter ended
   * the feed as soon as one hidden event landed on a page. A page can
   * therefore come back shorter than `limit` — aggregation shortens it too.
   */
  private async buildFeed(
    viewerId: string,
    rows: EventRow[],
    limit: number,
  ): Promise<PagedResult<ActivityEventDto>> {
    const { items: pageRows, hasMore } = toPagedResult(rows, limit);
    const page = await this.filterVisible(viewerId, pageRows);

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
   * target: a `"LIST"` event follows the list itself (own-scope pattern, like
   * Review — never facet-derived, see `resolveOwnVisibility`); everything
   * else is gated by the actor's per-domain Activité facet. A REVIEWED event
   * also carries the review's rating, so it must pass the review's own
   * audience too: a FRIENDS review's rating never reaches a stranger through
   * a public Activité facet, and a deleted review's events go with it.
   * Relation/settings are resolved once per user and reused across events (a
   * feed page spans few actors).
   *
   * A list event's actor can be an editor rather than the list's owner, so
   * the list's audience is read against *its owner's* profile and the
   * viewer's relation to that owner — the same rule `ListService.listForUser`
   * applies — never the editor's: a FRIENDS list must not reach the editor's
   * friends, nor a PUBLIC one escape its owner's private profile or a block.
   * The viewer's own membership opens the list as it does on the list page,
   * and a block with the editor still hides their events.
   */
  private async filterVisible(
    viewerId: string,
    rows: EventRow[],
  ): Promise<EventRow[]> {
    const relationCache = new Map<string, Promise<ViewerRelation>>();

    const relationTo = (user: { id: string; profileAccess: ProfileAccess }) => {
      let cached = relationCache.get(user.id);

      if (!cached) {
        cached = this.visibility.getRelation(viewerId, user);
        relationCache.set(user.id, cached);
      }

      return cached;
    };

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

      const access = actor.profileAccess as ProfileAccess;
      const entry = {
        access,
        relation: await relationTo({ id: actor.id, profileAccess: access }),
      };
      actorCache.set(actorId, entry);
      return entry;
    };

    const listIds = [
      ...new Set(
        rows.filter((r) => r.targetType === "LIST").map((r) => r.targetId),
      ),
    ];
    const lists = new Map(
      listIds.length
        ? (
            await this.prisma.list.findMany({
              where: { id: { in: listIds } },
              select: {
                id: true,
                visibility: true,
                user: { select: { id: true, profileAccess: true } },
                members: {
                  where: { userId: viewerId },
                  select: { userId: true },
                },
              },
            })
          ).map((l) => [l.id, l])
        : [],
    );

    const reviewVisibility = await this.reviewVisibilityByEvent(rows);

    const kept: EventRow[] = [];

    for (const row of rows) {
      const actor = await actorFor(row.userId);
      if (!actor) continue;

      if (row.targetType === "LIST") {
        const list = lists.get(row.targetId);
        if (!list) continue;
        if (actor.relation.blocking || actor.relation.blockedByTarget) continue;

        const owner = {
          id: list.user.id,
          profileAccess: list.user.profileAccess as ProfileAccess,
        };

        if (
          list.members.length > 0 ||
          resolveOwnVisibility(
            list.visibility as ListVisibility,
            owner.profileAccess,
            await relationTo(owner),
          )
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
      if (!ok) continue;

      if (row.type === "REVIEWED") {
        const audience = reviewVisibility.get(row.id);

        if (
          !audience ||
          !resolveOwnVisibility(audience, actor.access, actor.relation)
        ) {
          continue;
        }
      }

      kept.push(row);
    }

    return kept;
  }

  /**
   * The current audience of the review behind each REVIEWED event, keyed by
   * event id — absent when the review is gone. Events link their review
   * through `sourceId`; older ones predate that link and are matched on the
   * review's own unique key (author + work), which only work-level reviews
   * ever recorded.
   */
  private async reviewVisibilityByEvent(
    rows: EventRow[],
  ): Promise<Map<string, ReviewVisibility>> {
    const reviewed = rows.filter((r) => r.type === "REVIEWED");
    const result = new Map<string, ReviewVisibility>();
    if (reviewed.length === 0) return result;

    const linked = reviewed.filter((r) => r.sourceType === "Review");
    const legacy = reviewed.filter((r) => r.sourceType !== "Review");

    const [byId, byWork] = await Promise.all([
      linked.length
        ? this.prisma.review.findMany({
            where: { id: { in: linked.map((r) => r.sourceId ?? "") } },
            select: { id: true, visibility: true },
          })
        : [],
      legacy.length
        ? this.prisma.review.findMany({
            where: {
              OR: legacy.map((r) => ({
                userId: r.userId,
                targetType: r.targetType as ReviewTargetType,
                targetId: r.targetId,
              })),
            },
            select: {
              userId: true,
              targetType: true,
              targetId: true,
              visibility: true,
            },
          })
        : [],
    ]);

    const visibilityById = new Map(byId.map((r) => [r.id, r.visibility]));
    const workKey = (r: {
      userId: string | null;
      targetType: string;
      targetId: string;
    }) => `${r.userId}:${r.targetType}:${r.targetId}`;
    const visibilityByWork = new Map(
      byWork.map((r) => [workKey(r), r.visibility]),
    );

    for (const row of linked) {
      const visibility = visibilityById.get(row.sourceId ?? "");
      if (visibility) result.set(row.id, visibility as ReviewVisibility);
    }

    for (const row of legacy) {
      const visibility = visibilityByWork.get(workKey(row));
      if (visibility) result.set(row.id, visibility as ReviewVisibility);
    }

    return result;
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

  private async resolveSnapshot(
    targetType: string,
    targetId: string,
  ): Promise<{
    title: string;
    imageUrl: string | null;
    href: string | null;
  } | null> {
    switch (targetType) {
      case "MEDIA": {
        const i = await this.prisma.mediaItem.findUnique({
          where: { id: targetId },
          select: {
            title: true,
            posterUrl: true,
            type: true,
            ...CANONICAL_EXTERNAL_ID_SELECT,
          },
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
          select: {
            title: true,
            coverUrl: true,
            ...CANONICAL_EXTERNAL_ID_SELECT,
          },
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
          select: {
            title: true,
            coverUrl: true,
            ...CANONICAL_EXTERNAL_ID_SELECT,
          },
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
          select: {
            title: true,
            coverUrl: true,
            ...CANONICAL_EXTERNAL_ID_SELECT,
          },
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
