import type {
  AdminCacheDeleteOrphansResultDto,
  AdminCacheItemDetailDto,
  AdminCacheItemDto,
  AdminCacheListResponseDto,
  AdminCacheResyncStaleResultDto,
  AdminCacheSort,
  CommentTargetType,
  ReviewTargetType,
} from "@loomkeep/shared";
import {
  BadRequestException,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { BookItemService } from "../books/book-item.service";
import { MediaItemService } from "../catalog/media-item.service";
import { GameItemService } from "../games/game-item.service";
import { MusicItemService } from "../music/music-item.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminOnly } from "./admin-only.decorator";

const PAGE_SIZE = 50;
const STALE_TTL_MS = 24 * 60 * 60 * 1000;
const DOMAINS = ["MEDIA", "GAMES", "BOOKS", "MUSIC"] as const;
type CacheDomain = (typeof DOMAINS)[number];

/** An item with no library/game/book/music entry pointing at it, across every account. */
const ORPHAN_WHERE = { entries: { none: {} } } as const;

/**
 * Review/Comment/ActivityEvent target an item by a polymorphic
 * (targetType, targetId) pair, not a real FK — Prisma can't join them to
 * MediaItem/GameItem/etc, so "does this item still have content on it" has
 * to be checked by hand rather than folded into the entries-based ORPHAN_WHERE.
 * Work-level only (a SEASON/EPISODE review/comment on a work with zero
 * *work-level* rows is a narrower, accepted gap — see the cache page's admin
 * memory note).
 */
const TARGET_TYPE: Record<CacheDomain, string> = {
  MEDIA: "MEDIA",
  GAMES: "GAME",
  BOOKS: "BOOK",
  MUSIC: "MUSIC",
};

/** Ordering shared by every domain — the field names all exist on each model. */
function orderByFor(sort: AdminCacheSort) {
  switch (sort) {
    case "recent":
      return { createdAt: "desc" as const };
    case "title":
      return { title: "asc" as const };
    case "stale":
    default:
      return { lastSyncedAt: "asc" as const };
  }
}

/** Browse the on-demand catalogue cache: list, inspect, re-sync and prune. */
@AdminOnly()
@Controller("admin")
export class AdminCacheController {
  private readonly logger = new Logger(AdminCacheController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaItems: MediaItemService,
    private readonly gameItems: GameItemService,
    private readonly bookItems: BookItemService,
    private readonly musicItems: MusicItemService,
  ) {}

  /**
   * Cached items for one domain, ordered by `sort` and optionally scoped to
   * orphans, plus the domain-wide stale/orphan subtotals that drive the bulk
   * actions (those counts ignore search/orphans so they reflect the whole domain).
   */
  @Get("cache")
  async list(
    @Query("domain") domain: string,
    @Query("search") search?: string,
    @Query("sort") sort?: string,
    @Query("orphans") orphans?: string,
    @Query("page") page?: string,
  ): Promise<AdminCacheListResponseDto> {
    const cacheDomain = this.domainOrThrow(domain);
    const pageNum = page ? Math.max(1, Number(page)) : 1;
    const skip = (pageNum - 1) * PAGE_SIZE;
    const query = search?.trim();
    const orderBy = orderByFor((sort as AdminCacheSort) ?? "stale");
    const orphansOnly = orphans === "true";

    const where = {
      ...(query
        ? { title: { contains: query, mode: "insensitive" as const } }
        : {}),
      ...(orphansOnly ? ORPHAN_WHERE : {}),
    };
    const staleWhere = { lastSyncedAt: { lt: this.staleBefore() } };

    const findArgs = {
      where,
      orderBy,
      skip,
      take: PAGE_SIZE,
      include: { _count: { select: { entries: true } } },
    };

    switch (cacheDomain) {
      case "MEDIA": {
        const [rows, total, staleTotal, orphanTotal] = await Promise.all([
          this.prisma.mediaItem.findMany(findArgs),
          this.prisma.mediaItem.count({ where }),
          this.prisma.mediaItem.count({ where: staleWhere }),
          this.prisma.mediaItem.count({ where: ORPHAN_WHERE }),
        ]);
        return {
          total,
          staleTotal,
          orphanTotal,
          items: rows.map((r) =>
            this.toDto("MEDIA", r, r.posterUrl, r._count.entries),
          ),
        };
      }

      case "GAMES": {
        const [rows, total, staleTotal, orphanTotal] = await Promise.all([
          this.prisma.gameItem.findMany(findArgs),
          this.prisma.gameItem.count({ where }),
          this.prisma.gameItem.count({ where: staleWhere }),
          this.prisma.gameItem.count({ where: ORPHAN_WHERE }),
        ]);
        return {
          total,
          staleTotal,
          orphanTotal,
          items: rows.map((r) =>
            this.toDto("GAMES", r, r.coverUrl, r._count.entries),
          ),
        };
      }

      case "BOOKS": {
        const [rows, total, staleTotal, orphanTotal] = await Promise.all([
          this.prisma.bookItem.findMany(findArgs),
          this.prisma.bookItem.count({ where }),
          this.prisma.bookItem.count({ where: staleWhere }),
          this.prisma.bookItem.count({ where: ORPHAN_WHERE }),
        ]);
        return {
          total,
          staleTotal,
          orphanTotal,
          items: rows.map((r) =>
            this.toDto("BOOKS", r, r.coverUrl, r._count.entries),
          ),
        };
      }

      case "MUSIC": {
        const [rows, total, staleTotal, orphanTotal] = await Promise.all([
          this.prisma.musicItem.findMany(findArgs),
          this.prisma.musicItem.count({ where }),
          this.prisma.musicItem.count({ where: staleWhere }),
          this.prisma.musicItem.count({ where: ORPHAN_WHERE }),
        ]);
        return {
          total,
          staleTotal,
          orphanTotal,
          items: rows.map((r) =>
            this.toDto("MUSIC", r, r.coverUrl, r._count.entries),
          ),
        };
      }
    }
  }

  /** Cache-state detail of one item (freshness, external ids, media seasons, in-app link). */
  @Get("cache/:domain/:id")
  async detail(
    @Param("domain") domain: string,
    @Param("id") id: string,
  ): Promise<AdminCacheItemDetailDto> {
    const cacheDomain = this.domainOrThrow(domain);

    switch (cacheDomain) {
      case "MEDIA": {
        const item = await this.prisma.mediaItem.findUnique({
          where: { id },
          include: {
            externalIds: true,
            seasons: {
              orderBy: { number: "asc" },
              include: { _count: { select: { episodes: true } } },
            },
            _count: { select: { entries: true } },
          },
        });
        if (!item) throw new NotFoundException("Item introuvable");
        const sourceId = this.canonicalId(
          item.canonicalSource,
          item.externalIds,
        );
        return this.toDetailDto("MEDIA", item, item.posterUrl, {
          externalIds: item.externalIds,
          referenceCount: item._count.entries,
          detailPath: `/app/media/${item.type.toLowerCase()}/${sourceId}`,
          seasons: item.seasons.map((s) => ({
            number: s.number,
            title: s.title,
            episodeCount: s._count.episodes,
          })),
        });
      }

      case "GAMES": {
        const item = await this.prisma.gameItem.findUnique({
          where: { id },
          include: {
            externalIds: true,
            _count: { select: { entries: true } },
          },
        });
        if (!item) throw new NotFoundException("Item introuvable");
        const sourceId = this.canonicalId(
          item.canonicalSource,
          item.externalIds,
        );
        return this.toDetailDto("GAMES", item, item.coverUrl, {
          externalIds: item.externalIds,
          referenceCount: item._count.entries,
          detailPath: `/app/games/${sourceId}`,
          seasons: [],
        });
      }

      case "BOOKS": {
        const item = await this.prisma.bookItem.findUnique({
          where: { id },
          include: {
            externalIds: true,
            _count: { select: { entries: true } },
          },
        });
        if (!item) throw new NotFoundException("Item introuvable");
        const sourceId = this.canonicalId(
          item.canonicalSource,
          item.externalIds,
        );
        return this.toDetailDto("BOOKS", item, item.coverUrl, {
          externalIds: item.externalIds,
          referenceCount: item._count.entries,
          detailPath: `/app/books/${sourceId}`,
          seasons: [],
        });
      }

      case "MUSIC": {
        const item = await this.prisma.musicItem.findUnique({
          where: { id },
          include: {
            externalIds: true,
            _count: { select: { entries: true } },
          },
        });
        if (!item) throw new NotFoundException("Item introuvable");
        const sourceId = this.canonicalId(
          item.canonicalSource,
          item.externalIds,
        );
        return this.toDetailDto("MUSIC", item, item.coverUrl, {
          externalIds: item.externalIds,
          referenceCount: item._count.entries,
          detailPath: `/app/music/${sourceId}`,
          seasons: [],
        });
      }
    }
  }

  /** Forces a re-sync from the canonical source, bypassing the 24h TTL. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("cache/:domain/:id/resync")
  async resync(
    @Param("domain") domain: string,
    @Param("id") id: string,
  ): Promise<void> {
    const cacheDomain = this.domainOrThrow(domain);

    try {
      await this.forceRefresh(cacheDomain, id);
    } catch (err) {
      this.logger.error(`Resync failed for ${cacheDomain}/${id}`, err);
      throw new NotFoundException("Item introuvable ou source injoignable");
    }
  }

  /** Re-syncs every stale (>24h) item in a domain in one pass. */
  @Post("cache/:domain/resync-stale")
  async resyncStale(
    @Param("domain") domain: string,
  ): Promise<AdminCacheResyncStaleResultDto> {
    const cacheDomain = this.domainOrThrow(domain);
    const ids = await this.staleIds(cacheDomain);

    let resynced = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        await this.forceRefresh(cacheDomain, id);
        resynced++;
      } catch (err) {
        this.logger.error(`Bulk resync failed for ${cacheDomain}/${id}`, err);
        failed++;
      }
    }

    return { resynced, failed };
  }

  /**
   * Purges every orphaned (unreferenced) item in a domain — except ones that
   * still carry a review/comment/activity row, which are skipped rather than
   * silently stranding that content (see `idsWithContent`). Declared before
   * the `:id` delete so "orphans" isn't swallowed as an id.
   */
  @Delete("cache/:domain/orphans")
  async removeOrphans(
    @Param("domain") domain: string,
  ): Promise<AdminCacheDeleteOrphansResultDto> {
    const cacheDomain = this.domainOrThrow(domain);

    const orphanIds: string[] =
      cacheDomain === "MEDIA"
        ? (
            await this.prisma.mediaItem.findMany({
              where: ORPHAN_WHERE,
              select: { id: true },
            })
          ).map((o) => o.id)
        : cacheDomain === "GAMES"
          ? (
              await this.prisma.gameItem.findMany({
                where: ORPHAN_WHERE,
                select: { id: true },
              })
            ).map((o) => o.id)
          : cacheDomain === "BOOKS"
            ? (
                await this.prisma.bookItem.findMany({
                  where: ORPHAN_WHERE,
                  select: { id: true },
                })
              ).map((o) => o.id)
            : (
                await this.prisma.musicItem.findMany({
                  where: ORPHAN_WHERE,
                  select: { id: true },
                })
              ).map((o) => o.id);

    const withContent = await this.idsWithContent(cacheDomain, orphanIds);
    const deletable = orphanIds.filter((id) => !withContent.has(id));
    const where = { id: { in: deletable } };

    const { count } =
      cacheDomain === "MEDIA"
        ? await this.prisma.mediaItem.deleteMany({ where })
        : cacheDomain === "GAMES"
          ? await this.prisma.gameItem.deleteMany({ where })
          : cacheDomain === "BOOKS"
            ? await this.prisma.bookItem.deleteMany({ where })
            : await this.prisma.musicItem.deleteMany({ where });

    return { deleted: count, skipped: withContent.size };
  }

  /**
   * Deletes an orphaned cached item (no account references it). Referenced
   * items 409 — a delete would strand another user's library/watch history.
   * Same 409 when a review/comment/activity row still targets it: those
   * outlive a library entry today (only MEDIA's own `deleteEntry` cleans
   * them up on removal, games/books/music don't yet — see admin memory),
   * so an orphan can still carry content the delete would otherwise orphan
   * forever (no FK, nothing else would ever clean it up).
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("cache/:domain/:id")
  async remove(
    @Param("domain") domain: string,
    @Param("id") id: string,
  ): Promise<void> {
    const cacheDomain = this.domainOrThrow(domain);
    const references = await this.referenceCount(cacheDomain, id);
    if (references === null) throw new NotFoundException("Item introuvable");

    if (references > 0) {
      throw new ConflictException(
        "Référencé par au moins un compte — impossible de supprimer",
      );
    }

    if ((await this.idsWithContent(cacheDomain, [id])).size > 0) {
      throw new ConflictException(
        "Des critiques, commentaires ou activités référencent encore cet item — impossible de supprimer",
      );
    }

    switch (cacheDomain) {
      case "MEDIA":
        await this.prisma.mediaItem.delete({ where: { id } });
        return;
      case "GAMES":
        await this.prisma.gameItem.delete({ where: { id } });
        return;
      case "BOOKS":
        await this.prisma.bookItem.delete({ where: { id } });
        return;
      case "MUSIC":
        await this.prisma.musicItem.delete({ where: { id } });
        return;
    }
  }

  /** Subset of `ids` that still have a work-level review, comment, or activity row. */
  private async idsWithContent(
    domain: CacheDomain,
    ids: string[],
  ): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const targetType = TARGET_TYPE[domain];
    const [reviews, comments, activity] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          targetType: targetType as ReviewTargetType,
          targetId: { in: ids },
        },
        select: { targetId: true },
      }),
      this.prisma.comment.findMany({
        where: {
          targetType: targetType as CommentTargetType,
          targetId: { in: ids },
        },
        select: { targetId: true },
      }),
      this.prisma.activityEvent.findMany({
        where: { targetType, targetId: { in: ids } },
        select: { targetId: true },
      }),
    ]);
    return new Set([
      ...reviews.map((r) => r.targetId),
      ...comments.map((c) => c.targetId),
      ...activity.map((a) => a.targetId),
    ]);
  }

  private staleBefore(): Date {
    return new Date(Date.now() - STALE_TTL_MS);
  }

  /** The item's id in its own canonical source (the one the Loomkeep page addresses). */
  private canonicalId(
    canonicalSource: string,
    externalIds: { source: string; externalId: string }[],
  ): string {
    const match = externalIds.find((e) => e.source === canonicalSource);
    return match?.externalId ?? externalIds[0]?.externalId ?? "";
  }

  private forceRefresh(domain: CacheDomain, id: string): Promise<unknown> {
    switch (domain) {
      case "MEDIA":
        return this.mediaItems.forceRefresh(id);
      case "GAMES":
        return this.gameItems.forceRefresh(id);
      case "BOOKS":
        return this.bookItems.forceRefresh(id);
      case "MUSIC":
        return this.musicItems.forceRefresh(id);
    }
  }

  private async staleIds(domain: CacheDomain): Promise<string[]> {
    const where = { lastSyncedAt: { lt: this.staleBefore() } };
    const select = { id: true };
    const rows =
      domain === "MEDIA"
        ? await this.prisma.mediaItem.findMany({ where, select })
        : domain === "GAMES"
          ? await this.prisma.gameItem.findMany({ where, select })
          : domain === "BOOKS"
            ? await this.prisma.bookItem.findMany({ where, select })
            : await this.prisma.musicItem.findMany({ where, select });
    return rows.map((r) => r.id);
  }

  /** Reference count for one item, or null when the item does not exist. */
  private async referenceCount(
    domain: CacheDomain,
    id: string,
  ): Promise<number | null> {
    switch (domain) {
      case "MEDIA": {
        const item = await this.prisma.mediaItem.findUnique({
          where: { id },
          include: { _count: { select: { entries: true } } },
        });
        return item ? item._count.entries : null;
      }

      case "GAMES": {
        const item = await this.prisma.gameItem.findUnique({
          where: { id },
          include: { _count: { select: { entries: true } } },
        });
        return item ? item._count.entries : null;
      }

      case "BOOKS": {
        const item = await this.prisma.bookItem.findUnique({
          where: { id },
          include: { _count: { select: { entries: true } } },
        });
        return item ? item._count.entries : null;
      }

      case "MUSIC": {
        const item = await this.prisma.musicItem.findUnique({
          where: { id },
          include: { _count: { select: { entries: true } } },
        });
        return item ? item._count.entries : null;
      }
    }
  }

  private domainOrThrow(domain: string): CacheDomain {
    if (!DOMAINS.includes(domain as CacheDomain)) {
      throw new BadRequestException(`Unknown cache domain: ${domain}`);
    }

    return domain as CacheDomain;
  }

  private toDto(
    domain: CacheDomain,
    item: {
      id: string;
      title: string;
      canonicalSource: string;
      lastSyncedAt: Date;
      createdAt: Date;
    },
    coverUrl: string | null,
    referenceCount: number,
  ): AdminCacheItemDto {
    return {
      id: item.id,
      domain,
      title: item.title,
      coverUrl,
      canonicalSource: item.canonicalSource,
      lastSyncedAt: item.lastSyncedAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
      referenceCount,
      stale: Date.now() - item.lastSyncedAt.getTime() >= STALE_TTL_MS,
    };
  }

  private toDetailDto(
    domain: CacheDomain,
    item: {
      id: string;
      title: string;
      canonicalSource: string;
      lastSyncedAt: Date;
      createdAt: Date;
      updatedAt: Date;
    },
    coverUrl: string | null,
    extra: {
      externalIds: { source: string; externalId: string }[];
      referenceCount: number;
      detailPath: string;
      seasons: { number: number; title: string | null; episodeCount: number }[];
    },
  ): AdminCacheItemDetailDto {
    return {
      ...this.toDto(domain, item, coverUrl, extra.referenceCount),
      updatedAt: item.updatedAt.toISOString(),
      externalIds: extra.externalIds.map((e) => ({
        source: e.source,
        externalId: e.externalId,
      })),
      seasons: extra.seasons,
      detailPath: extra.detailPath,
    };
  }
}
