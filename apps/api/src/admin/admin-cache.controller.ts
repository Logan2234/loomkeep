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
import { ErrorCode } from "@loomkeep/shared";
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { Prisma } from "@prisma/client";
import { BookItemService } from "../books/book-item.service";
import { MediaItemService } from "../catalog/media-item.service";
import { AppException } from "../common/app.exception";
import { DEFAULT_PAGE_SIZE, parsePageQuery } from "../common/pagination.util";
import { GameItemService } from "../games/game-item.service";
import { MusicItemService } from "../music/music-item.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminOnly } from "./admin-only.decorator";
import { AdminCacheDeleteOrphansResultResponseDto } from "./dto/admin-cache-delete-orphans-result-response.dto";
import { AdminCacheItemDetailResponseDto } from "./dto/admin-cache-item-detail-response.dto";
import { AdminCacheListResultResponseDto } from "./dto/admin-cache-list-response.dto";
import { AdminCacheResyncStaleResultResponseDto } from "./dto/admin-cache-resync-stale-result-response.dto";

const STALE_TTL_MS = 24 * 60 * 60 * 1000;
const DOMAINS = ["MEDIA", "GAMES", "BOOKS", "MUSIC"] as const;
type CacheDomain = (typeof DOMAINS)[number];
type CachePrisma = PrismaService | Prisma.TransactionClient;

/** An item with no library/game/book/music entry pointing at it, across every account. */
const ORPHAN_WHERE = { entries: { none: {} } } as const;

/**
 * Review/Comment/ActivityEvent target an item by a polymorphic
 * (targetType, targetId) pair, not a real FK — Prisma can't join them to
 * MediaItem/GameItem/etc, so "does this item still have content on it" has
 * to be checked by hand rather than folded into the entries-based ORPHAN_WHERE.
 * MEDIA also checks content targeting its seasons and episodes because those
 * child rows cascade when the cached media item is removed.
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
  @ApiOkResponse({ type: AdminCacheListResultResponseDto })
  async list(
    @Query("domain") domain: string,
    @Query("search") search?: string,
    @Query("sort") sort?: string,
    @Query("orphans") orphans?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<AdminCacheListResponseDto> {
    const cacheDomain = this.domainOrThrow(domain);
    const { skip, take } = parsePageQuery(page, limit, DEFAULT_PAGE_SIZE);
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
      take,
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
        const locales = await this.translatedLocales(rows.map((r) => r.id));
        return {
          total,
          hasMore: skip + rows.length < total,
          staleTotal,
          orphanTotal,
          items: rows.map((r) =>
            this.toDto(
              "MEDIA",
              r,
              r.posterUrl,
              r._count.entries,
              locales.get(r.id),
            ),
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
          hasMore: skip + rows.length < total,
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
          hasMore: skip + rows.length < total,
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
          hasMore: skip + rows.length < total,
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
  @ApiOkResponse({ type: AdminCacheItemDetailResponseDto })
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
        if (!item)
          throw new AppException(
            HttpStatus.NOT_FOUND,
            ErrorCode.AdminCacheItemNotFound,
          );
        const sourceId = this.canonicalId(
          item.canonicalSource,
          item.externalIds,
        );
        const locales = await this.translatedLocales([item.id]);
        return this.toDetailDto(
          "MEDIA",
          item,
          item.posterUrl,
          {
            externalIds: item.externalIds,
            referenceCount: item._count.entries,
            detailPath: `/app/media/${item.type.toLowerCase()}/${sourceId}`,
            seasons: item.seasons.map((s) => ({
              number: s.number,
              title: s.title,
              episodeCount: s._count.episodes,
            })),
          },
          locales.get(item.id),
        );
      }

      case "GAMES": {
        const item = await this.prisma.gameItem.findUnique({
          where: { id },
          include: {
            externalIds: true,
            _count: { select: { entries: true } },
          },
        });
        if (!item)
          throw new AppException(
            HttpStatus.NOT_FOUND,
            ErrorCode.AdminCacheItemNotFound,
          );
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
        if (!item)
          throw new AppException(
            HttpStatus.NOT_FOUND,
            ErrorCode.AdminCacheItemNotFound,
          );
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
        if (!item)
          throw new AppException(
            HttpStatus.NOT_FOUND,
            ErrorCode.AdminCacheItemNotFound,
          );
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.AdminCacheResyncFailed,
      );
    }
  }

  /** Re-syncs every stale (>24h) item in a domain in one pass. */
  @Post("cache/:domain/resync-stale")
  @ApiCreatedResponse({ type: AdminCacheResyncStaleResultResponseDto })
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
  @ApiOkResponse({ type: AdminCacheDeleteOrphansResultResponseDto })
  async removeOrphans(
    @Param("domain") domain: string,
  ): Promise<AdminCacheDeleteOrphansResultDto> {
    const cacheDomain = this.domainOrThrow(domain);

    const purge = async (db: CachePrisma) => {
      const orphanIds: string[] =
        cacheDomain === "MEDIA"
          ? (
              await db.mediaItem.findMany({
                where: ORPHAN_WHERE,
                select: { id: true },
              })
            ).map((o) => o.id)
          : cacheDomain === "GAMES"
            ? (
                await db.gameItem.findMany({
                  where: ORPHAN_WHERE,
                  select: { id: true },
                })
              ).map((o) => o.id)
            : cacheDomain === "BOOKS"
              ? (
                  await db.bookItem.findMany({
                    where: ORPHAN_WHERE,
                    select: { id: true },
                  })
                ).map((o) => o.id)
              : (
                  await db.musicItem.findMany({
                    where: ORPHAN_WHERE,
                    select: { id: true },
                  })
                ).map((o) => o.id);

      const withContent = await this.idsWithContent(cacheDomain, orphanIds, db);
      const deletable = orphanIds.filter((id) => !withContent.has(id));
      const where = { id: { in: deletable } };

      const { count } =
        cacheDomain === "MEDIA"
          ? await db.mediaItem.deleteMany({ where })
          : cacheDomain === "GAMES"
            ? await db.gameItem.deleteMany({ where })
            : cacheDomain === "BOOKS"
              ? await db.bookItem.deleteMany({ where })
              : await db.musicItem.deleteMany({ where });

      return { deleted: count, skipped: withContent.size };
    };

    return cacheDomain === "MEDIA"
      ? this.prisma.$transaction(purge, {
          isolationLevel: "Serializable",
          timeout: 60_000,
        })
      : purge(this.prisma);
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

    const purge = async (db: CachePrisma) => {
      const references = await this.referenceCount(cacheDomain, id, db);
      if (references === null)
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.AdminCacheItemNotFound,
        );

      if (references > 0) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.AdminCacheItemReferenced,
          undefined,
          "Referenced by at least one account — cannot delete",
        );
      }

      if ((await this.idsWithContent(cacheDomain, [id], db)).size > 0) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.AdminCacheItemHasContent,
          undefined,
          "Reviews, comments or activity still reference this item — cannot delete",
        );
      }

      switch (cacheDomain) {
        case "MEDIA":
          await db.mediaItem.delete({ where: { id } });
          return;
        case "GAMES":
          await db.gameItem.delete({ where: { id } });
          return;
        case "BOOKS":
          await db.bookItem.delete({ where: { id } });
          return;
        case "MUSIC":
          await db.musicItem.delete({ where: { id } });
          return;
      }
    };

    if (cacheDomain === "MEDIA") {
      await this.prisma.$transaction(purge, {
        isolationLevel: "Serializable",
        timeout: 60_000,
      });
    } else {
      await purge(this.prisma);
    }
  }

  /** Subset of `ids` with content on the work or, for MEDIA, a child. */
  private async idsWithContent(
    domain: CacheDomain,
    ids: string[],
    db: CachePrisma,
  ): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const targetType = TARGET_TYPE[domain];
    const parentByTarget = new Map(
      ids.map((id) => [`${targetType}:${id}`, id]),
    );
    const targetGroups: { type: string; ids: string[] }[] = [
      { type: targetType, ids },
    ];

    if (domain === "MEDIA") {
      const seasons = await db.season.findMany({
        where: { mediaItemId: { in: ids } },
        select: {
          id: true,
          mediaItemId: true,
          episodes: { select: { id: true } },
        },
      });
      const seasonIds: string[] = [];
      const episodeIds: string[] = [];

      for (const season of seasons) {
        seasonIds.push(season.id);
        parentByTarget.set(`SEASON:${season.id}`, season.mediaItemId);

        for (const episode of season.episodes) {
          episodeIds.push(episode.id);
          parentByTarget.set(`EPISODE:${episode.id}`, season.mediaItemId);
        }
      }

      if (seasonIds.length)
        targetGroups.push({ type: "SEASON", ids: seasonIds });
      if (episodeIds.length)
        targetGroups.push({ type: "EPISODE", ids: episodeIds });
    }

    const where = {
      OR: targetGroups.map(({ type, ids: targetIds }) => ({
        targetType: type,
        targetId: { in: targetIds },
      })),
    };
    const [reviews, comments, activity] = await Promise.all([
      db.review.findMany({
        where: {
          OR: where.OR.map((target) => ({
            ...target,
            targetType: target.targetType as ReviewTargetType,
          })),
        },
        select: { targetType: true, targetId: true },
      }),
      db.comment.findMany({
        where: {
          OR: where.OR.map((target) => ({
            ...target,
            targetType: target.targetType as CommentTargetType,
          })),
        },
        select: { targetType: true, targetId: true },
      }),
      db.activityEvent.findMany({
        where,
        select: { targetType: true, targetId: true },
      }),
    ]);
    return new Set(
      [...reviews, ...comments, ...activity]
        .map((row) => parentByTarget.get(`${row.targetType}:${row.targetId}`))
        .filter((id): id is string => id !== undefined),
    );
  }

  /**
   * MEDIA items' cached locales, keyed by id — the base row's own language
   * ("en") plus whatever MediaItemTranslation rows exist for each.
   */
  private async translatedLocales(
    mediaItemIds: string[],
  ): Promise<Map<string, string[]>> {
    if (mediaItemIds.length === 0) return new Map();

    const rows = await this.prisma.mediaItemTranslation.findMany({
      where: { mediaItemId: { in: mediaItemIds } },
      select: { mediaItemId: true, locale: true },
    });

    const byItem = new Map<string, string[]>();
    for (const id of mediaItemIds) byItem.set(id, ["en"]);
    for (const row of rows) byItem.get(row.mediaItemId)?.push(row.locale);
    return byItem;
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
    db: CachePrisma,
  ): Promise<number | null> {
    switch (domain) {
      case "MEDIA": {
        const item = await db.mediaItem.findUnique({
          where: { id },
          include: { _count: { select: { entries: true } } },
        });
        return item ? item._count.entries : null;
      }

      case "GAMES": {
        const item = await db.gameItem.findUnique({
          where: { id },
          include: { _count: { select: { entries: true } } },
        });
        return item ? item._count.entries : null;
      }

      case "BOOKS": {
        const item = await db.bookItem.findUnique({
          where: { id },
          include: { _count: { select: { entries: true } } },
        });
        return item ? item._count.entries : null;
      }

      case "MUSIC": {
        const item = await db.musicItem.findUnique({
          where: { id },
          include: { _count: { select: { entries: true } } },
        });
        return item ? item._count.entries : null;
      }
    }
  }

  private domainOrThrow(domain: string): CacheDomain {
    if (!DOMAINS.includes(domain as CacheDomain)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.InvalidParam,
        { label: "cache domain", value: domain },
        `Unknown cache domain: ${domain}`,
      );
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
    cachedLocales: string[] = [],
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
      cachedLocales,
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
    cachedLocales: string[] = [],
  ): AdminCacheItemDetailDto {
    return {
      ...this.toDto(
        domain,
        item,
        coverUrl,
        extra.referenceCount,
        cachedLocales,
      ),
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
