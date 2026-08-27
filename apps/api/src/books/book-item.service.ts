import type {
  BookDetailsDto,
  BookSource,
  BookSummaryDto,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import type { BookItem } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  BookCatalogProvider,
  ProviderBookDetails,
} from "./providers/book-provider.types";
import { OpenLibraryProvider } from "./providers/open-library.provider";

// A cached book referenced by users is refreshed at most once a day.
const SYNC_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class BookItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openLibraryProvider: OpenLibraryProvider,
  ) {}

  /** Open Library is the only source today. */
  providerFor(): BookCatalogProvider {
    return this.openLibraryProvider;
  }

  /** Free-text catalogue search. `lang`: the signed-in user's locale, when known. */
  async search(query: string, lang?: string): Promise<BookSummaryDto[]> {
    return this.openLibraryProvider.search(query, lang).catch(() => []);
  }

  /**
   * Resolve one book (an ISBN and/or a free-text query) to a single catalogue
   * work: ISBN first, then by query. Unlike `search()`, this does NOT swallow
   * provider errors — a bulk import needs to tell "the API call failed" apart
   * from "genuinely no match", so callers catch and handle it themselves.
   */
  async resolve(
    isbn: string | null,
    query: string,
  ): Promise<BookSummaryDto | null> {
    if (isbn) {
      const byIsbn = await this.openLibraryProvider.searchByIsbn(isbn);
      if (byIsbn) return byIsbn;
    }

    const results = await this.openLibraryProvider.search(query);
    return results[0] ?? null;
  }

  /**
   * Bulk-resolve many ISBNs in as few calls as possible — see
   * `OpenLibraryProvider.searchByIsbns()`. No fallback: an ISBN reported in
   * `failedIsbns` is not retried individually.
   */
  resolveByIsbns(isbns: string[]): Promise<{
    matches: Map<string, BookSummaryDto>;
    failedIsbns: string[];
  }> {
    return this.openLibraryProvider.searchByIsbns(isbns);
  }

  /**
   * Live details straight from the provider — nothing is persisted.
   * `lang`: the signed-in user's locale, when known.
   */
  async getLiveDetails(
    source: BookSource,
    sourceId: string,
    lang?: string,
  ): Promise<BookDetailsDto> {
    const details = await this.providerFor().getDetails(sourceId, lang);
    return {
      ...details.summary,
      overview: details.overview,
      subtitle: details.subtitle,
      publisher: details.publisher,
      genres: details.genres,
      pageCount: details.pageCount,
      releaseDate: details.releaseDate,
      website: details.website,
      sameAuthorBooks: details.sameAuthorBooks,
      ratings: details.ratings,
      editionCount: details.editionCount,
      isbn: details.isbn,
      series: details.series,
      language: details.language,
      firstSentence: details.firstSentence,
      readOnlineUrl: details.readOnlineUrl,
      externalLinks: details.externalLinks,
    };
  }

  /**
   * On-demand cache entry point: called when a user starts referencing a book.
   * Fetches from the canonical source and persists the book with its external
   * IDs. Throttled by lastSyncedAt (24h TTL).
   */
  async upsertFromSource(
    source: BookSource,
    sourceId: string,
  ): Promise<BookItem> {
    const existingRef = await this.prisma.bookExternalId.findUnique({
      where: { source_externalId: { source, externalId: sourceId } },
      include: { bookItem: true },
    });

    if (
      existingRef &&
      Date.now() - existingRef.bookItem.lastSyncedAt.getTime() < SYNC_TTL_MS
    ) {
      return existingRef.bookItem;
    }

    const details = await this.providerFor().getDetails(sourceId);
    return this.persistDetails(source, details);
  }

  /**
   * Persist a book from details already fetched from the provider (create or
   * refresh).
   */
  async persistDetails(
    source: BookSource,
    details: ProviderBookDetails,
  ): Promise<BookItem> {
    const canonicalId = details.externalIds.find(
      (ext) => ext.source === source,
    )?.externalId;

    if (!canonicalId) {
      throw new Error(`Provider details for ${source} carry no ${source} id`);
    }

    const existingRef = await this.prisma.bookExternalId.findUnique({
      where: { source_externalId: { source, externalId: canonicalId } },
    });
    return existingRef
      ? this.refresh(existingRef.bookItemId, details)
      : this.createFresh(source, details);
  }

  /** Admin-triggered re-sync: refetches from the canonical source, bypassing the TTL. */
  async forceRefresh(bookItemId: string): Promise<BookItem> {
    const item = await this.prisma.bookItem.findUniqueOrThrow({
      where: { id: bookItemId },
      include: { externalIds: true },
    });
    const sourceId = item.externalIds.find(
      (ext) => ext.source === item.canonicalSource,
    )?.externalId;

    if (!sourceId) {
      throw new Error(`Book ${bookItemId} has no ${item.canonicalSource} id`);
    }

    const details = await this.providerFor().getDetails(sourceId);
    return this.persistDetails(item.canonicalSource as BookSource, details);
  }

  private async createFresh(
    source: BookSource,
    details: ProviderBookDetails,
  ): Promise<BookItem> {
    return this.prisma.bookItem.create({
      data: {
        ...this.baseFields(details),
        canonicalSource: source,
        externalIds: {
          create: details.externalIds.map((ext) => ({
            source: ext.source,
            externalId: ext.externalId,
          })),
        },
      },
    });
  }

  private async refresh(
    bookItemId: string,
    details: ProviderBookDetails,
  ): Promise<BookItem> {
    const item = await this.prisma.bookItem.update({
      where: { id: bookItemId },
      data: this.baseFields(details),
    });

    for (const ext of details.externalIds) {
      await this.prisma.bookExternalId.upsert({
        where: {
          source_externalId: { source: ext.source, externalId: ext.externalId },
        },
        update: { bookItemId },
        create: { bookItemId, source: ext.source, externalId: ext.externalId },
      });
    }

    return item;
  }

  private baseFields(details: ProviderBookDetails) {
    return {
      title: details.summary.title,
      authors: details.summary.authors,
      coverUrl: details.summary.coverUrl,
      overview: details.overview,
      releaseDate: details.releaseDate ? new Date(details.releaseDate) : null,
      genres: details.genres,
      pageCount: details.pageCount,
      isAdult: details.summary.isAdult,
      lastSyncedAt: new Date(),
    };
  }
}
