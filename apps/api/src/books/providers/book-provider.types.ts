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
  /** Permalink to the volume's page on the source, when it exposes one. */
  website: string | null;
  /** Other books by the primary author, standing in for "similar titles". */
  sameAuthorBooks: BookSummaryDto[];
  /** Google Books' own average rating, when known. */
  ratings: RatingDto[];
  externalIds: ProviderBookExternalId[];
}

export interface BookCatalogProvider {
  readonly source: BookSource;
  search(query: string): Promise<BookSummaryDto[]>;
  /** Resolve a single work by ISBN; null when the source knows none. */
  searchByIsbn(isbn: string): Promise<BookSummaryDto | null>;
  getDetails(sourceId: string): Promise<ProviderBookDetails>;
}
