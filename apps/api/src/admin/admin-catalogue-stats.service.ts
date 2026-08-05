import { Injectable } from "@nestjs/common";
import type {
  AdminCacheDomainRowDto,
  AdminCatalogueSectionDto,
  AdminPopularWorkDto,
  StatsDomain,
} from "@tracklore/shared";
import { Domain } from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  percent,
  POPULAR_WORKS_LIMIT,
  rankPopularWorks,
  summariseReferences,
  type DomainReferenceCounts,
} from "./admin-catalogue-stats.util";
import { cumulativeBucketize, trendBucketStarts } from "./admin-stats.util";

// Mirrors the 24h refresh TTL in MediaItemService — a freshness proxy only.
// Games/books/music have no periodic refresh cron, so their staleness stays
// null rather than being invented from `lastSyncedAt`.
const MEDIA_SYNC_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Fixed window of the per-domain growth sparklines: 12 weekly buckets. Unlike
 * the "Nouveaux comptes" card this one has no period picker — the sparkline is
 * there to show a shape, not to be read precisely.
 */
const GROWTH_PERIOD = "week" as const;

/** One cached-item reference tally: how many library entries point at each item. */
interface DomainReferences extends DomainReferenceCounts {
  /** Item id → entry count, for the items that lead the ranking. */
  top: { id: string; entries: number }[];
}

/** The slice of a Prisma item delegate a per-domain cache row reads. */
interface CachedItemDelegate {
  count(args?: { where: { createdAt: { lt: Date } } }): Promise<number>;
  findMany(args: {
    where: { createdAt: { gte: Date } };
    select: { createdAt: true };
  }): Promise<{ createdAt: Date }[]>;
}

/** "Catalogue & cache" section of /admin/stats. */
@Injectable()
export class AdminCatalogueStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<AdminCatalogueSectionDto> {
    const now = new Date();
    const starts = trendBucketStarts(GROWTH_PERIOD, now);

    const [media, games, books, music, refs] = await Promise.all([
      this.mediaRow(starts),
      this.domainRow(Domain.GAMES, this.prisma.gameItem, starts),
      this.domainRow(Domain.BOOKS, this.prisma.bookItem, starts),
      this.domainRow(Domain.MUSIC, this.prisma.musicItem, starts),
      this.references(),
    ]);

    const { orphanCount, sharedPercent } = summariseReferences(
      Object.values(refs),
    );

    return {
      generatedAt: now.toISOString(),
      byDomain: [media, games, books, music],
      popular: rankPopularWorks(await this.popularWorks(refs)),
      sharedPercent,
      orphanCount,
    };
  }

  /**
   * Item count + cumulative growth curve for one domain. `stalePercent` stays
   * null: only MEDIA has a refresh TTL to be stale against (see mediaRow).
   */
  private async domainRow(
    domain: StatsDomain,
    model: CachedItemDelegate,
    starts: Date[],
  ): Promise<AdminCacheDomainRowDto> {
    const [items, created, before] = await Promise.all([
      model.count(),
      model.findMany({
        where: { createdAt: { gte: starts[0] } },
        select: { createdAt: true },
      }),
      model.count({ where: { createdAt: { lt: starts[0] } } }),
    ]);

    return {
      domain,
      items,
      stalePercent: null,
      growth: cumulativeBucketize(
        created.map((r) => r.createdAt),
        starts,
        before,
      ),
    };
  }

  /** MEDIA's row, plus the staleness share only it can report. */
  private async mediaRow(starts: Date[]): Promise<AdminCacheDomainRowDto> {
    const [row, stale] = await Promise.all([
      this.domainRow(Domain.MEDIA, this.prisma.mediaItem, starts),
      this.prisma.mediaItem.count({
        where: {
          lastSyncedAt: { lt: new Date(Date.now() - MEDIA_SYNC_TTL_MS) },
        },
      }),
    ]);

    return { ...row, stalePercent: percent(stale, row.items) };
  }

  /**
   * One grouped pass per domain over the entry tables. It answers three
   * questions at once (popularity ranking, mutualisation, orphans), which is
   * why it isn't folded into the per-domain rows above.
   */
  private async references(): Promise<Record<StatsDomain, DomainReferences>> {
    const [
      mediaItems,
      gameItems,
      bookItems,
      musicItems,
      mediaGroups,
      gameGroups,
      bookGroups,
      musicGroups,
    ] = await Promise.all([
      this.prisma.mediaItem.count(),
      this.prisma.gameItem.count(),
      this.prisma.bookItem.count(),
      this.prisma.musicItem.count(),
      this.prisma.libraryEntry.groupBy({
        by: ["mediaItemId"],
        _count: { _all: true },
      }),
      this.prisma.gameEntry.groupBy({
        by: ["gameItemId"],
        _count: { _all: true },
      }),
      this.prisma.bookEntry.groupBy({
        by: ["bookItemId"],
        _count: { _all: true },
      }),
      this.prisma.musicEntry.groupBy({
        by: ["musicItemId"],
        _count: { _all: true },
      }),
    ]);

    const reduce = (
      totalItems: number,
      rows: { id: string; entries: number }[],
    ): DomainReferences => ({
      totalItems,
      entriesPerItem: rows.map((r) => r.entries),
      top: [...rows]
        .sort((a, b) => b.entries - a.entries)
        .slice(0, POPULAR_WORKS_LIMIT),
    });

    return {
      [Domain.MEDIA]: reduce(
        mediaItems,
        mediaGroups.map((g) => ({ id: g.mediaItemId, entries: g._count._all })),
      ),
      [Domain.GAMES]: reduce(
        gameItems,
        gameGroups.map((g) => ({ id: g.gameItemId, entries: g._count._all })),
      ),
      [Domain.BOOKS]: reduce(
        bookItems,
        bookGroups.map((g) => ({ id: g.bookItemId, entries: g._count._all })),
      ),
      [Domain.MUSIC]: reduce(
        musicItems,
        musicGroups.map((g) => ({ id: g.musicItemId, entries: g._count._all })),
      ),
    };
  }

  /** Resolves the per-domain leaders into titled rows for the mixed ranking. */
  private async popularWorks(
    refs: Record<StatsDomain, DomainReferences>,
  ): Promise<AdminPopularWorkDto[]> {
    const ids = (domain: StatsDomain) => refs[domain].top.map((t) => t.id);
    const entriesOf = (domain: StatsDomain, id: string) =>
      refs[domain].top.find((t) => t.id === id)?.entries ?? 0;

    const [media, games, books, music] = await Promise.all([
      this.prisma.mediaItem.findMany({
        where: { id: { in: ids(Domain.MEDIA) } },
        select: { id: true, title: true },
      }),
      this.prisma.gameItem.findMany({
        where: { id: { in: ids(Domain.GAMES) } },
        select: { id: true, title: true },
      }),
      this.prisma.bookItem.findMany({
        where: { id: { in: ids(Domain.BOOKS) } },
        select: { id: true, title: true },
      }),
      this.prisma.musicItem.findMany({
        where: { id: { in: ids(Domain.MUSIC) } },
        select: { id: true, title: true, artists: true },
      }),
    ]);

    return [
      ...media.map((m) => ({
        domain: Domain.MEDIA,
        title: m.title,
        entries: entriesOf(Domain.MEDIA, m.id),
      })),
      ...games.map((g) => ({
        domain: Domain.GAMES,
        title: g.title,
        entries: entriesOf(Domain.GAMES, g.id),
      })),
      ...books.map((b) => ({
        domain: Domain.BOOKS,
        title: b.title,
        entries: entriesOf(Domain.BOOKS, b.id),
      })),
      // Albums need their artist to be identifiable ("Radiohead — OK Computer").
      ...music.map((m) => ({
        domain: Domain.MUSIC,
        title: m.artists[0] ? `${m.artists[0]} — ${m.title}` : m.title,
        entries: entriesOf(Domain.MUSIC, m.id),
      })),
    ];
  }
}
