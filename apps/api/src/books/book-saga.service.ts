import type {
  BookSagaDto,
  BookSagaMemberDto,
  BookStatus,
  LibraryBookSagasDto,
  LibrarySagaSort,
} from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { mapWithConcurrency } from "../common/concurrency.util";
import {
  sagaComparator,
  sagaProgress,
  type SagaStatusReader,
} from "../library/saga-progress.util";
import { PrismaService } from "../prisma/prisma.service";
import { BookItemService } from "./book-item.service";
import type { ProviderBookSeries } from "./providers/book-provider.types";

// Same freshness as a cached BookItem.
const SERIES_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED_SERIES = 5000;

const BOOK_SAGA_STATUS: SagaStatusReader<BookSagaMemberDto> = {
  isSeen: (m) => m.status === "READ",
  isDropped: (m) => m.status === "DROPPED",
};

export interface LibraryBookSagaFilters {
  q?: string;
  sort?: LibrarySagaSort;
  order?: "asc" | "desc";
  lang?: string;
}

/**
 * Book series as the reader sees them: the one on a book's page, and the
 * ones started across their library. Open Library is read live and cached a
 * day per series and language — nothing of a series is saved but which one
 * each tracked book belongs to (`BookItem.seriesKey`).
 */
@Injectable()
export class BookSagaService {
  private readonly logger = new Logger(BookSagaService.name);
  private readonly cache = new Map<
    string,
    { fetchedAt: number; series: ProviderBookSeries | null }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly books: BookItemService,
  ) {}

  async getSaga(
    userId: string,
    seriesKey: string,
    lang?: string,
  ): Promise<BookSagaDto | null> {
    const series = await this.read(seriesKey, lang);
    if (!series) return null;

    const ids = series.members.map((m) => m.sourceId);
    const [statuses] = await Promise.all([
      this.statusesBySourceId(userId, ids),
      this.rememberMembership(ids, seriesKey),
    ]);
    return {
      key: series.key,
      title: series.title,
      members: series.members.map((m) => ({
        ...m,
        status: statuses.get(m.sourceId) ?? null,
      })),
    };
  }

  /** The series of the reader's library: started, then finished. */
  async listSagas(
    userId: string,
    filters: LibraryBookSagaFilters = {},
  ): Promise<LibraryBookSagasDto> {
    const entries = await this.prisma.bookEntry.findMany({
      where: { userId, bookItem: { seriesKey: { not: null } } },
      select: {
        updatedAt: true,
        finishedAt: true,
        bookItem: { select: { seriesKey: true } },
      },
    });
    const lastActivity = new Map<string, Date>();
    const lastFinished = new Map<string, Date>();

    for (const { updatedAt, finishedAt, bookItem } of entries) {
      const key = bookItem.seriesKey!;
      const last = lastActivity.get(key);
      if (!last || updatedAt > last) lastActivity.set(key, updatedAt);
      const finished = lastFinished.get(key);

      if (finishedAt && (!finished || finishedAt > finished)) {
        lastFinished.set(key, finishedAt);
      }
    }

    const keys = [...lastActivity.keys()];
    const read = await mapWithConcurrency(keys, 4, (key) =>
      this.read(key, filters.lang).catch((err) => {
        this.logger.warn(`Series read failed: ${key}`, err);
        return null;
      }),
    );
    const series = read.filter((s): s is ProviderBookSeries => s !== null);
    const statuses = await this.statusesBySourceId(
      userId,
      series.flatMap((s) => s.members.map((m) => m.sourceId)),
    );
    const q = filters.q?.trim().toLowerCase();
    const result: LibraryBookSagasDto = {
      inProgress: [],
      waiting: [],
      finished: [],
    };

    for (const { key, title, members: volumes } of series) {
      const members = volumes.map((m) => ({
        ...m,
        status: statuses.get(m.sourceId) ?? null,
      }));

      if (
        q &&
        !title.toLowerCase().includes(q) &&
        !members.some((m) => m.title.toLowerCase().includes(q))
      ) {
        continue;
      }

      const progress = sagaProgress(members, BOOK_SAGA_STATUS);
      if (progress.state === "none") continue;
      result[progress.state].push({
        key,
        title,
        members,
        next: progress.next,
        seen: progress.seen,
        released: progress.released,
        lastActivityAt: lastActivity.get(key)!.toISOString(),
        finishedAt: lastFinished.get(key)?.toISOString() ?? null,
      });
    }

    const compare = sagaComparator(filters.sort ?? "recent");
    const direction = filters.order === "asc" ? -1 : 1;

    for (const list of [result.inProgress, result.finished]) {
      list.sort((a, b) => compare(a, b) * direction);
    }

    return result;
  }

  private async read(
    seriesKey: string,
    lang = "en",
  ): Promise<ProviderBookSeries | null> {
    const cacheKey = `${seriesKey}:${lang}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < SERIES_TTL_MS) {
      return cached.series;
    }

    const series = await this.books.providerFor().getSeries(seriesKey, lang);
    // Re-inserted so the oldest entries are the first to go.
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, { fetchedAt: Date.now(), series });

    for (const key of this.cache.keys()) {
      if (this.cache.size <= MAX_CACHED_SERIES) break;
      this.cache.delete(key);
    }

    return series;
  }

  private async statusesBySourceId(
    userId: string,
    sourceIds: string[],
  ): Promise<Map<string, BookStatus>> {
    if (sourceIds.length === 0) return new Map();
    const entries = await this.prisma.bookEntry.findMany({
      where: {
        userId,
        bookItem: {
          externalIds: {
            some: { source: "OPEN_LIBRARY", externalId: { in: sourceIds } },
          },
        },
      },
      select: {
        status: true,
        bookItem: {
          select: {
            externalIds: {
              where: { source: "OPEN_LIBRARY" },
              select: { externalId: true },
            },
          },
        },
      },
    });
    return new Map(
      entries.flatMap((e) =>
        e.bookItem.externalIds.map(
          (ext) => [ext.externalId, e.status] as const,
        ),
      ),
    );
  }

  /**
   * Ties the tracked volumes to their series now, for a book tracked before
   * series were read — the refresh would only get to it within a day.
   */
  private rememberMembership(sourceIds: string[], seriesKey: string) {
    return this.prisma.bookItem.updateMany({
      where: {
        seriesKey: null,
        externalIds: {
          some: { source: "OPEN_LIBRARY", externalId: { in: sourceIds } },
        },
      },
      data: { seriesKey },
    });
  }
}
