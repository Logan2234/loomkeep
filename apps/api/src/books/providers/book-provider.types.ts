import type { BookSource, BookSummaryDto, RatingDto } from "@loomkeep/shared";

interface ProviderBookExternalId {
  source: BookSource;
  externalId: string;
}

/** Everything a provider knows about one book, in canonical form. */
export interface ProviderBookDetails {
  summary: BookSummaryDto;
  overview: string | null;
  subtitle: string | null;
  publisher: string | null;
  genres: string[];
  pageCount: number | null;
  releaseDate: string | null;
  /** Permalink to the picked edition's page on the source, when known. */
  website: string | null;
  /** Other books by the primary author, standing in for "similar titles". */
  sameAuthorBooks: BookSummaryDto[];
  /** The source's own average rating, when known. */
  ratings: RatingDto[];
  externalIds: ProviderBookExternalId[];
  /** Number of editions Open Library has catalogued for the work. */
  editionCount: number | null;
  /** ISBN of the picked edition, when known. */
  isbn: string | null;
  series: string | null;
  /** Human-readable language of the picked edition, when known. */
  language: string | null;
  firstSentence: string | null;
  /** Free full-text scan on the Internet Archive, when Open Library links one. */
  readOnlineUrl: string | null;
  /** Cross-reference links (Goodreads, LibraryThing, Amazon…), when known. */
  externalLinks: { label: string; url: string }[];
}

export interface BookCatalogProvider {
  readonly source: BookSource;
  /** `lang` (ISO 639-1, e.g. "fr"): the signed-in user's locale, when known. */
  search(query: string, lang?: string): Promise<BookSummaryDto[]>;
  /** Resolve a single work by ISBN; null when the source knows none. */
  searchByIsbn(isbn: string): Promise<BookSummaryDto | null>;
  /** `lang` (ISO 639-1, e.g. "fr"): the signed-in user's locale, when known. */
  getDetails(sourceId: string, lang?: string): Promise<ProviderBookDetails>;
}
