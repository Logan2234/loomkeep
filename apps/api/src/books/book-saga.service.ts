import type {
  BookSagaDto,
  BookSagaMemberDto,
  BookStatus,
  LibraryBookSagasDto,
  LibrarySagaSort,
} from "@loomkeep/shared";
import { type SortOrder } from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { mapWithConcurrency } from "../common/concurrency.util";
import {
  completedSagaWorks,
  sagaComparator,
  sagaProgress,
  type SagaStatusReader,
} from "../library/saga-progress.util";
import { PrismaService } from "../prisma/prisma.service";
import { BookItemService } from "./book-item.service";
import type { ProviderBookSeries } from "./providers/book-provider.types";

// A published series rarely changes; an announced volume shows up within
// this, read again in the background once a saved series is older.
const SERIES_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const BOOK_SAGA_STATUS: SagaStatusReader<BookSagaMemberDto> = {
  isSeen: (m) => m.status === "READ",
  isDropped: (m) => m.status === "DROPPED",
};

export interface LibraryBookSagaFilters {
  q?: string;
  sort?: LibrarySagaSort;
  order?: SortOrder;
  lang?: string;
}

/**
 * Book series as the reader sees them: the one on a book's page, and the
 * ones started across their library. Each series is read from Open Library
 * once per language and saved (`BookSeries`), so a restart doesn't make the
 * sagas view wait on one search per series again.
 */
@Injectable()
export class BookSagaService {
  private readonly logger = new Logger(BookSagaService.name);
  // Series being read again in the background, so a busy view asks once.
  private readonly refreshing = new Set<string>();

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

  /**
   * The series `seriesKey` once the reader has finished it — every volume
   * read — with how many volumes it counts; null otherwise.
   */
  async completed(
    userId: string,
    seriesKey: string,
  ): Promise<{ title: string; works: number } | null> {
    const saga = await this.getSaga(userId, seriesKey);
    if (!saga) return null;
    const works = completedSagaWorks(saga.members, BOOK_SAGA_STATUS);
    return works === null ? null : { title: saga.title, works };
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

    const series = await this.readMany([...lastActivity.keys()], filters.lang);
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
    const saved = await this.prisma.bookSeries.findUnique({
      where: { key_locale: { key: seriesKey, locale: lang } },
    });
    if (!saved) return this.fetch(seriesKey, lang);
    this.refreshIfStale(saved);
    return saved.series as ProviderBookSeries | null;
  }

  /** The series saved, and the ones never read in this language asked for now. */
  private async readMany(
    seriesKeys: string[],
    lang = "en",
  ): Promise<ProviderBookSeries[]> {
    const saved = await this.prisma.bookSeries.findMany({
      where: { key: { in: seriesKeys }, locale: lang },
    });
    const savedKeys = new Set(saved.map((row) => row.key));
    saved.forEach((row) => this.refreshIfStale(row));

    const fetched = await mapWithConcurrency(
      seriesKeys.filter((key) => !savedKeys.has(key)),
      4,
      (key) =>
        this.fetch(key, lang).catch((err) => {
          this.logger.warn(`Series read failed: ${key}`, err);
          return null;
        }),
    );
    return [
      ...saved.map((row) => row.series as ProviderBookSeries | null),
      ...fetched,
    ].filter((series): series is ProviderBookSeries => series !== null);
  }

  private async fetch(
    seriesKey: string,
    lang: string,
  ): Promise<ProviderBookSeries | null> {
    const series = await this.books.providerFor().getSeries(seriesKey, lang);
    const data = {
      series: (series as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
      fetchedAt: new Date(),
    };
    await this.prisma.bookSeries.upsert({
      where: { key_locale: { key: seriesKey, locale: lang } },
      create: { key: seriesKey, locale: lang, ...data },
      update: data,
    });
    return series;
  }

  private refreshIfStale(saved: {
    key: string;
    locale: string;
    fetchedAt: Date;
  }): void {
    const id = `${saved.key}:${saved.locale}`;
    if (Date.now() - saved.fetchedAt.getTime() < SERIES_TTL_MS) return;
    if (this.refreshing.has(id)) return;

    this.refreshing.add(id);
    this.fetch(saved.key, saved.locale)
      .catch((err) => this.logger.warn(`Series refresh failed: ${id}`, err))
      .finally(() => this.refreshing.delete(id));
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
