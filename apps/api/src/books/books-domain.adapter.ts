import {
  type BookOwnershipStatus,
  ReviewTargetType,
} from "@loomkeep/shared/enums";
import { Injectable } from "@nestjs/common";
import { toCsv } from "../common/csv.util";
import {
  CANONICAL_EXTERNAL_ID_SELECT,
  canonicalExternalId,
  toExternalIdDtos,
} from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
import type { DomainAdapter, LibraryRow } from "../work/domain-adapter";
import { csvDate, itemHref, laterCompletions } from "../work/entry-export.util";
import { LOAN_INCLUDE, loanFields } from "../work/entry-loan.util";
import { bucketizeBookStatus } from "../work/status-bucket.util";
import type { DataExportBookEntry } from "./book-export.types";

/** The books library, as the modules that read every domain see it. */
@Injectable()
export class BooksDomainAdapter implements DomainAdapter<"BOOKS"> {
  readonly domain = "BOOKS";
  readonly reviewTargetType = ReviewTargetType.BOOK;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewService,
  ) {}

  countEntries(userId: string): Promise<number> {
    return this.prisma.bookEntry.count({ where: { userId } });
  }

  async libraryRows(userId: string): Promise<LibraryRow[]> {
    const entries = await this.prisma.bookEntry.findMany({
      where: { userId },
      select: {
        status: true,
        favorite: true,
        ownershipStatus: true,
        bookItem: {
          select: {
            id: true,
            title: true,
            coverUrl: true,
            releaseDate: true,
            ...CANONICAL_EXTERNAL_ID_SELECT,
          },
        },
      },
    });

    return entries.map((e) => ({
      bucket: bucketizeBookStatus(e.status),
      favorite: e.favorite,
      ownershipStatus: e.ownershipStatus,
      releaseDate: e.bookItem.releaseDate,
      itemId: e.bookItem.id,
      title: e.bookItem.title,
      imageUrl: e.bookItem.coverUrl,
      href: itemHref("books", e.bookItem),
    }));
  }

  async itemTitles(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const items = await this.prisma.bookItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true },
    });
    return new Map(items.map((i) => [i.id, i.title]));
  }

  async exportEntries(
    userId: string,
  ): Promise<{ books: DataExportBookEntry[] }> {
    const entries = await this.prisma.bookEntry.findMany({
      where: { userId },
      include: {
        bookItem: { include: { externalIds: true } },
        ...LOAN_INCLUDE,
        readings: { orderBy: { number: "asc" } },
        sessions: {
          orderBy: { occurredAt: "asc" },
          include: { reading: { select: { number: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    const ratings = await this.reviews.getRatings(
      userId,
      ReviewTargetType.BOOK,
      entries.map((e) => e.bookItemId),
    );

    return {
      books: entries.map((entry) => ({
        book: {
          title: entry.bookItem.title,
          authors: entry.bookItem.authors,
          canonicalSource: entry.bookItem.canonicalSource,
          sourceId: canonicalExternalId(
            entry.bookItem,
            entry.bookItem.externalIds,
          ),
          externalIds: toExternalIdDtos(entry.bookItem.externalIds),
        },
        status: entry.status,
        rating: ratings.get(entry.bookItemId) ?? null,
        notes: entry.notes,
        favorite: entry.favorite,
        currentPage: entry.currentPage,
        editionKey: entry.editionKey,
        referencePageCount: entry.referencePageCount,
        trackedReadingMinutes: entry.trackedReadingMinutes,
        ownershipStatus: entry.ownershipStatus as BookOwnershipStatus,
        ownershipSource: entry.ownershipSource,
        ...loanFields(entry),
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        replays: laterCompletions(entry.readings),
        readings: entry.readings.map((reading) => ({
          number: reading.number,
          status: reading.status,
          editionKey: reading.editionKey,
          referencePageCount: reading.referencePageCount,
          currentPage: reading.currentPage,
          pagesRead: reading.pagesRead,
          trackedMinutes: reading.trackedMinutes,
          startedAt: reading.startedAt?.toISOString() ?? null,
          finishedAt: reading.finishedAt?.toISOString() ?? null,
        })),
        sessions: entry.sessions.map((session) => ({
          durationMinutes: session.durationMinutes,
          pagesRead: session.pagesRead,
          startPage: session.startPage,
          endPage: session.endPage,
          notes: session.notes,
          occurredAt: session.occurredAt.toISOString(),
          source: session.source,
          createdAt: session.createdAt.toISOString(),
          readingNumber: session.reading?.number ?? null,
        })),
      })),
    };
  }

  async exportCsv(userId: string): Promise<string> {
    const entries = await this.prisma.bookEntry.findMany({
      where: { userId },
      include: {
        bookItem: true,
        readings: { where: { status: "COMPLETED" } },
      },
      orderBy: { createdAt: "asc" },
    });
    const ratings = await this.reviews.getRatings(
      userId,
      ReviewTargetType.BOOK,
      entries.map((e) => e.bookItemId),
    );

    return toCsv([
      [
        "Title",
        "Authors",
        "Status",
        "Rating",
        "Notes",
        "Favorite",
        "Current Page",
        "Started At",
        "Finished At",
        "Ownership Status",
        "Ownership Source",
        "Release Date",
        "Page Count",
        "Genres",
        "Replays",
      ],
      ...entries.map((e) => [
        e.bookItem.title,
        e.bookItem.authors.join("; "),
        e.status,
        ratings.get(e.bookItemId) ?? null,
        e.notes,
        e.favorite ? "true" : "false",
        e.currentPage,
        csvDate(e.startedAt),
        csvDate(e.finishedAt),
        e.ownershipStatus,
        e.ownershipSource,
        csvDate(e.bookItem.releaseDate),
        e.bookItem.pageCount,
        e.bookItem.genres.join("; "),
        Math.max(0, e.readings.length - 1),
      ]),
    ]);
  }
}
