import {
  type AdminCacheDeleteOrphansResultDto,
  type AdminCacheItemDetailDto,
  type AdminCacheItemDto,
  type AdminCacheListResponseDto,
  type AdminCacheResyncStaleResultDto,
  type AdminCacheSort,
  type CommentTargetType,
  type ReviewTargetType,
  ErrorCode,
} from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { BookItemService } from "../books/book-item.service";
import { MediaItemService } from "../catalog/media-item.service";
import { AppException } from "../common/app.exception";
import {
  CATALOG_SYNC_TTL_MS,
  isCatalogFresh,
} from "../common/catalog-sync.util";
import { canonicalExternalId } from "../common/external-id.util";
import { GameItemService } from "../games/game-item.service";
import { MusicItemService } from "../music/music-item.service";
import { PrismaService } from "../prisma/prisma.service";

export const CACHE_DOMAINS = ["MEDIA", "GAMES", "BOOKS", "MUSIC"] as const;
export type CacheDomain = (typeof CACHE_DOMAINS)[number];
type CachePrisma = PrismaService | Prisma.TransactionClient;

/** An item with no library/game/book/music entry pointing at it, across every account. */
const ORPHAN_WHERE = { entries: { none: {} } } as const;

/** A cached item row as this service reads it — the fields all four models share, plus MEDIA's own. */
interface CacheRow {
  id: string;
  title: string;
  canonicalSource: string;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  /** MEDIA's cover. */
  posterUrl?: string | null;
  /** GAMES/BOOKS/MUSIC's cover. */
  coverUrl?: string | null;
  /** MEDIA's MediaType, part of its in-app path. */
  type?: string;
  _count: { entries: number };
  externalIds: { source: string; externalId: string }[];
  /** MEDIA only, when the detail query includes them. */
  seasons?: {
    number: number;
    title: string | null;
    _count: { episodes: number };
  }[];
}

/**
 * The slice of a cached-item Prisma delegate this service calls. The four
 * models share these fields and relations (`entries`, `externalIds`), so
 * every query below is valid on each; their generated delegate types just
 * aren't assignable to one another, hence the cast in {@link domainModel}.
 */
interface CacheItemModel {
  findMany(args: object): Promise<CacheRow[]>;
  findUnique(args: object): Promise<CacheRow | null>;
  count(args: object): Promise<number>;
  deleteMany(args: object): Promise<{ count: number }>;
}

interface CacheDomainDelegate {
  model(db: CachePrisma): unknown;
  /**
   * Review/Comment/ActivityEvent target an item by a polymorphic
   * (targetType, targetId) pair, not a real FK — Prisma can't join them to
   * MediaItem/GameItem/etc, so "does this item still have content on it" has
   * to be checked by hand rather than folded into the entries-based ORPHAN_WHERE.
   */
  targetType: string;
  cover(row: CacheRow): string | null;
  detailPath(row: CacheRow, sourceId: string): string;
  forceRefresh(id: string): Promise<unknown>;
  /**
   * Purges run in a Serializable transaction. MEDIA only: its seasons and
   * episodes cascade with it, so the content check spans several tables.
   */
  serializable: boolean;
}

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

/**
 * The on-demand catalogue cache, across its four domains: list, inspect,
 * re-sync and prune. Each domain differs only by its {@link CacheDomainDelegate};
 * a new domain is one more entry there, not one more branch per action.
 */
@Injectable()
export class AdminCacheService {
  private readonly logger = new Logger(AdminCacheService.name);
  private readonly domains: Record<CacheDomain, CacheDomainDelegate>;

  constructor(
    private readonly prisma: PrismaService,
    mediaItems: MediaItemService,
    gameItems: GameItemService,
    bookItems: BookItemService,
    musicItems: MusicItemService,
  ) {
    this.domains = {
      MEDIA: {
        model: (db) => db.mediaItem,
        targetType: "MEDIA",
        cover: (row) => row.posterUrl ?? null,
        detailPath: (row, sourceId) =>
          `/app/media/${row.type?.toLowerCase()}/${sourceId}`,
        forceRefresh: (id) => mediaItems.forceRefresh(id),
        serializable: true,
      },
      GAMES: {
        model: (db) => db.gameItem,
        targetType: "GAME",
        cover: (row) => row.coverUrl ?? null,
        detailPath: (_row, sourceId) => `/app/games/${sourceId}`,
        forceRefresh: (id) => gameItems.forceRefresh(id),
        serializable: false,
      },
      BOOKS: {
        model: (db) => db.bookItem,
        targetType: "BOOK",
        cover: (row) => row.coverUrl ?? null,
        detailPath: (_row, sourceId) => `/app/books/${sourceId}`,
        forceRefresh: (id) => bookItems.forceRefresh(id),
        serializable: false,
      },
      MUSIC: {
        model: (db) => db.musicItem,
        targetType: "MUSIC",
        cover: (row) => row.coverUrl ?? null,
        detailPath: (_row, sourceId) => `/app/music/${sourceId}`,
        forceRefresh: (id) => musicItems.forceRefresh(id),
        serializable: false,
      },
    };
  }

  /**
   * Cached items for one domain, ordered by `sort` and optionally scoped to
   * orphans, plus the domain-wide stale/orphan subtotals that drive the bulk
   * actions (those counts ignore search/orphans so they reflect the whole domain).
   */
  async list(
    domain: CacheDomain,
    options: {
      search?: string;
      sort: AdminCacheSort;
      orphansOnly: boolean;
      skip: number;
      take: number;
    },
  ): Promise<AdminCacheListResponseDto> {
    const { skip, take } = options;
    const model = this.domainModel(domain);
    const where = {
      ...(options.search
        ? { title: { contains: options.search, mode: "insensitive" as const } }
        : {}),
      ...(options.orphansOnly ? ORPHAN_WHERE : {}),
    };

    const [rows, total, staleTotal, orphanTotal] = await Promise.all([
      model.findMany({
        where,
        orderBy: orderByFor(options.sort),
        skip,
        take,
        include: { _count: { select: { entries: true } } },
      }),
      model.count({ where }),
      model.count({ where: { lastSyncedAt: { lt: this.staleBefore() } } }),
      model.count({ where: ORPHAN_WHERE }),
    ]);
    const locales =
      domain === "MEDIA"
        ? await this.translatedLocales(rows.map((r) => r.id))
        : new Map<string, string[]>();

    return {
      total,
      hasMore: skip + rows.length < total,
      staleTotal,
      orphanTotal,
      items: rows.map((r) => this.toDto(domain, r, locales.get(r.id))),
    };
  }

  /** Cache-state detail of one item (freshness, external ids, media seasons, in-app link). */
  async detail(
    domain: CacheDomain,
    id: string,
  ): Promise<AdminCacheItemDetailDto> {
    const item = await this.domainModel(domain).findUnique({
      where: { id },
      include: {
        externalIds: true,
        _count: { select: { entries: true } },
        ...(domain === "MEDIA"
          ? {
              seasons: {
                orderBy: { number: "asc" },
                include: { _count: { select: { episodes: true } } },
              },
            }
          : {}),
      },
    });
    if (!item)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.AdminCacheItemNotFound,
      );

    const sourceId = canonicalExternalId(
      { canonicalSource: item.canonicalSource },
      item.externalIds,
      item.externalIds[0]?.externalId ?? "",
    );
    const locales =
      domain === "MEDIA"
        ? await this.translatedLocales([item.id])
        : new Map<string, string[]>();

    return {
      ...this.toDto(domain, item, locales.get(item.id)),
      updatedAt: item.updatedAt.toISOString(),
      externalIds: item.externalIds.map((e) => ({
        source: e.source,
        externalId: e.externalId,
      })),
      seasons: (item.seasons ?? []).map((s) => ({
        number: s.number,
        title: s.title,
        episodeCount: s._count.episodes,
      })),
      detailPath: this.domains[domain].detailPath(item, sourceId),
    };
  }

  /** Forces a re-sync from the canonical source, bypassing the 24h TTL. */
  async resync(domain: CacheDomain, id: string): Promise<void> {
    try {
      await this.domains[domain].forceRefresh(id);
    } catch (err) {
      this.logger.error(`Resync failed for ${domain}/${id}`, err);
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.AdminCacheResyncFailed,
      );
    }
  }

  /** Re-syncs every stale (>24h) item in a domain in one pass. */
  async resyncStale(
    domain: CacheDomain,
  ): Promise<AdminCacheResyncStaleResultDto> {
    const rows = await this.domainModel(domain).findMany({
      where: { lastSyncedAt: { lt: this.staleBefore() } },
      select: { id: true },
    });

    let resynced = 0;
    let failed = 0;

    for (const { id } of rows) {
      try {
        await this.domains[domain].forceRefresh(id);
        resynced++;
      } catch (err) {
        this.logger.error(`Bulk resync failed for ${domain}/${id}`, err);
        failed++;
      }
    }

    return { resynced, failed };
  }

  /**
   * Purges every orphaned (unreferenced) item in a domain — except ones that
   * still carry a review/comment/activity row, which are skipped rather than
   * silently stranding that content (see `idsWithContent`).
   */
  removeOrphans(
    domain: CacheDomain,
  ): Promise<AdminCacheDeleteOrphansResultDto> {
    return this.inPurgeScope(domain, async (db) => {
      const model = this.domainModel(domain, db);
      const orphanIds = (
        await model.findMany({ where: ORPHAN_WHERE, select: { id: true } })
      ).map((o) => o.id);

      const withContent = await this.idsWithContent(domain, orphanIds, db);
      const deletable = orphanIds.filter((id) => !withContent.has(id));
      // Re-checked by the delete itself: someone may have started tracking
      // one of these since the scan above, and its entry would cascade away
      // with the item.
      const { count } = await model.deleteMany({
        where: { id: { in: deletable }, ...ORPHAN_WHERE },
      });

      return { deleted: count, skipped: withContent.size };
    });
  }

  /**
   * Deletes an orphaned cached item (no account references it). Referenced
   * items 409 — a delete would strand another user's library/watch history.
   * Same 409 when a review/comment/activity row still targets it: those
   * can still exist independently of a library entry, so an orphaned cached
   * item can carry content the delete would otherwise orphan
   * forever (no FK, nothing else would ever clean it up).
   */
  remove(domain: CacheDomain, id: string): Promise<void> {
    return this.inPurgeScope(domain, async (db) => {
      const model = this.domainModel(domain, db);
      const item = await model.findUnique({
        where: { id },
        include: { _count: { select: { entries: true } } },
      });
      if (!item)
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.AdminCacheItemNotFound,
        );

      if (item._count.entries > 0) throw referencedError();

      if ((await this.idsWithContent(domain, [id], db)).size > 0) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.AdminCacheItemHasContent,
          undefined,
          "Reviews, comments or activity still reference this item — cannot delete",
        );
      }

      // Conditional on still being unreferenced, for the same reason as
      // removeOrphans: a track since the count above would otherwise
      // cascade away with the item.
      const { count } = await model.deleteMany({
        where: { id, ...ORPHAN_WHERE },
      });
      if (count === 0) throw referencedError();
    });
  }

  private inPurgeScope<T>(
    domain: CacheDomain,
    purge: (db: CachePrisma) => Promise<T>,
  ): Promise<T> {
    return this.domains[domain].serializable
      ? this.prisma.$transaction(purge, {
          isolationLevel: "Serializable",
          timeout: 60_000,
        })
      : purge(this.prisma);
  }

  private domainModel(
    domain: CacheDomain,
    db: CachePrisma = this.prisma,
  ): CacheItemModel {
    return this.domains[domain].model(db) as CacheItemModel;
  }

  /** Subset of `ids` with content on the work or, for MEDIA, a child. */
  private async idsWithContent(
    domain: CacheDomain,
    ids: string[],
    db: CachePrisma,
  ): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const { targetType } = this.domains[domain];
    const parentByTarget = new Map(
      ids.map((id) => [`${targetType}:${id}`, id]),
    );
    const targetGroups: { type: string; ids: string[] }[] = [
      { type: targetType, ids },
    ];

    // MEDIA also checks content targeting its seasons and episodes, because
    // those child rows cascade when the cached media item is removed.
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
    return new Date(Date.now() - CATALOG_SYNC_TTL_MS);
  }

  private toDto(
    domain: CacheDomain,
    item: CacheRow,
    cachedLocales: string[] = [],
  ): AdminCacheItemDto {
    return {
      id: item.id,
      domain,
      title: item.title,
      coverUrl: this.domains[domain].cover(item),
      canonicalSource: item.canonicalSource,
      lastSyncedAt: item.lastSyncedAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
      referenceCount: item._count.entries,
      stale: !isCatalogFresh(item.lastSyncedAt),
      cachedLocales,
    };
  }
}

function referencedError(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    ErrorCode.AdminCacheItemReferenced,
    undefined,
    "Referenced by at least one account — cannot delete",
  );
}
