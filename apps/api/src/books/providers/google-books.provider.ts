import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RatingDto } from "@loomkeep/shared";
import { BookSource, BookSummaryDto } from "@loomkeep/shared";
import { chunk } from "../../common/array.util";
import { QuotaTrackerService } from "../../common/quota-tracker.service";
import type {
  BookCatalogProvider,
  ProviderBookDetails,
} from "./book-provider.types";

const API_URL = "https://www.googleapis.com/books/v1/volumes";

// Google Books has no "similar books" endpoint; other works by the primary
// author is the closest keyless equivalent. Capped so the carousel stays a
// quick browse, not an endless scroll.
const MAX_SAME_AUTHOR_BOOKS = 10;

// Google Books caps `maxResults` at 40 — also used as the batch size for
// `searchByIsbns()` (one "isbn:A OR isbn:B OR …" query per chunk).
const MAX_RESULTS_PER_PAGE = 40;

interface GoogleImageLinks {
  smallThumbnail?: string;
  thumbnail?: string;
}

interface GoogleIndustryIdentifier {
  type?: string; // "ISBN_10" | "ISBN_13" | …
  identifier?: string;
}

interface GoogleVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string; // "2013", "2013-09" or "2013-09-17".
  description?: string;
  pageCount?: number;
  categories?: string[];
  imageLinks?: GoogleImageLinks;
  // Stable permalink to the volume's Google Books page. `previewLink` also
  // exists but opens the embedded preview reader instead — not what we want
  // for a plain external link.
  canonicalVolumeLink?: string;
  averageRating?: number; // 1–5.
  ratingsCount?: number;
  industryIdentifiers?: GoogleIndustryIdentifier[];
  maturityRating?: string; // "NOT_MATURE" | "MATURE".
}

interface GoogleVolume {
  id: string;
  volumeInfo?: GoogleVolumeInfo;
}

interface GoogleVolumeList {
  totalItems: number;
  items?: GoogleVolume[];
}

/**
 * Books, from the Google Books API — the sole book source. A single call
 * carries everything we need (title, authors, description, categories, page
 * count and a cover) for both search and details.
 */
@Injectable()
export class GoogleBooksProvider implements BookCatalogProvider {
  readonly source = BookSource.GOOGLE_BOOKS;

  constructor(
    private readonly configService: ConfigService,
    private readonly quota: QuotaTrackerService,
  ) {}

  async search(query: string): Promise<BookSummaryDto[]> {
    const params = new URLSearchParams({
      q: query,
      maxResults: "20",
      printType: "books",
    });
    const data = await this.get<GoogleVolumeList>(`?${params}`);
    return (data.items ?? []).map((v) => this.toSummary(v));
  }

  async searchByIsbn(isbn: string): Promise<BookSummaryDto | null> {
    const params = new URLSearchParams({
      q: `isbn:${isbn}`,
      maxResults: "1",
      printType: "books",
    });
    const data = await this.get<GoogleVolumeList>(`?${params}`);
    const volume = data.items?.[0];
    return volume ? this.toSummary(volume) : null;
  }

  /**
   * Resolve many ISBNs in as few requests as possible: chunks of up to
   * {@link MAX_RESULTS_PER_PAGE} joined into one "isbn:A OR isbn:B OR …"
   * query each, instead of one call per ISBN — a bulk import can carry
   * hundreds of ISBNs and this keeps it well under the API's per-100-seconds
   * quota. No per-ISBN retry: an ISBN whose chunk request fails is reported
   * in `failedIsbns`, not retried individually.
   */
  async searchByIsbns(isbns: string[]): Promise<{
    matches: Map<string, BookSummaryDto>;
    failedIsbns: string[];
  }> {
    const matches = new Map<string, BookSummaryDto>();
    const failedIsbns: string[] = [];

    for (const batch of chunk(isbns, MAX_RESULTS_PER_PAGE)) {
      try {
        const params = new URLSearchParams({
          q: batch.map((isbn) => `isbn:${isbn}`).join(" OR "),
          maxResults: String(batch.length),
          printType: "books",
        });
        const data = await this.get<GoogleVolumeList>(`?${params}`);

        for (const volume of data.items ?? []) {
          for (const id of volume.volumeInfo?.industryIdentifiers ?? []) {
            if (
              id.identifier &&
              batch.includes(id.identifier) &&
              !matches.has(id.identifier)
            ) {
              matches.set(id.identifier, this.toSummary(volume));
            }
          }
        }
      } catch {
        failedIsbns.push(...batch);
      }
    }

    return { matches, failedIsbns };
  }

  async getDetails(sourceId: string): Promise<ProviderBookDetails> {
    let volume: GoogleVolume;

    try {
      volume = await this.get<GoogleVolume>(`/${encodeURIComponent(sourceId)}`);
    } catch {
      throw new NotFoundException("Book not found on Google Books");
    }

    const info = volume.volumeInfo ?? {};
    return {
      summary: this.toSummary(volume),
      overview: info.description ? stripHtml(info.description) : null,
      subtitle: info.subtitle ?? null,
      publisher: info.publisher ?? null,
      genres: info.categories ?? [],
      pageCount: info.pageCount ?? null,
      releaseDate: toIsoDate(info.publishedDate),
      website: info.canonicalVolumeLink ?? null,
      sameAuthorBooks: await this.sameAuthorBooks(volume.id, info.authors?.[0]),
      ratings: toRatings(info),
      externalIds: [{ source: BookSource.GOOGLE_BOOKS, externalId: volume.id }],
    };
  }

  /** Other books by the primary author, excluding this one. */
  private async sameAuthorBooks(
    excludeId: string,
    author: string | undefined,
  ): Promise<BookSummaryDto[]> {
    if (!author) return [];

    // Drop quotes so the author name can't break out of the query literal.
    const safeAuthor = author.replace(/"/g, "");
    const results = await this.search(`inauthor:"${safeAuthor}"`).catch(
      () => [],
    );
    return results
      .filter((b) => b.sourceId !== excludeId)
      .slice(0, MAX_SAME_AUTHOR_BOOKS);
  }

  private toSummary(volume: GoogleVolume): BookSummaryDto {
    const info = volume.volumeInfo ?? {};
    return {
      source: BookSource.GOOGLE_BOOKS,
      sourceId: volume.id,
      title: info.title ?? "Sans titre",
      authors: info.authors ?? [],
      year: parseYear(info.publishedDate),
      coverUrl: coverUrl(info.imageLinks),
      isAdult: info.maturityRating === "MATURE",
    };
  }

  /**
   * GET a Google Books path, appending the (required) API key. Retries
   * transient failures (429 rate limit, 5xx) with backoff — a bulk import
   * can fire hundreds of calls in a burst and easily trips the API's
   * per-100-seconds quota; honours `Retry-After` when Google sends one.
   */
  private async get<T>(path: string): Promise<T> {
    const key = this.configService.getOrThrow<string>("GOOGLE_BOOKS_API_KEY");
    const sep = path.includes("?") ? "&" : "?";
    const url = `${API_URL}${path}${sep}key=${key}`;

    let lastStatus = 0;

    for (let attempt = 1; attempt <= GET_MAX_ATTEMPTS; attempt++) {
      this.quota.record("googleBooks");
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (response.ok) return (await response.json()) as T;

      lastStatus = response.status;
      const transient = response.status === 429 || response.status >= 500;

      if (transient && attempt < GET_MAX_ATTEMPTS) {
        await sleep(retryDelayMs(response.headers.get("Retry-After"), attempt));
        continue;
      }

      break;
    }

    throw new BadGatewayException(
      `Google Books request failed with status ${lastStatus}`,
    );
  }
}

const GET_MAX_ATTEMPTS = 3;

/** `Retry-After` (seconds) when Google sends one; else exponential backoff. */
function retryDelayMs(
  retryAfterHeader: string | null,
  attempt: number,
): number {
  const retryAfterSec = Number(retryAfterHeader);

  if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
    return retryAfterSec * 1000;
  }

  return 500 * 2 ** (attempt - 1); // 500ms, then 1000ms.
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Google Books' own average rating (1–5), when known. */
function toRatings(info: GoogleVolumeInfo): RatingDto[] {
  if (info.averageRating === null || info.averageRating === undefined) {
    return [];
  }

  const count = info.ratingsCount ? ` (${info.ratingsCount})` : "";
  return [{ source: "Google Books", score: `${info.averageRating}/5${count}` }];
}

/** Google serves thumbnails over http; upgrade to https so the PWA can load them. */
function coverUrl(links: GoogleImageLinks | undefined): string | null {
  const raw = links?.thumbnail ?? links?.smallThumbnail;
  return raw ? raw.replace(/^http:/, "https:") : null;
}

function parseYear(publishedDate: string | undefined): number | null {
  const year = Number(publishedDate?.slice(0, 4));
  return Number.isInteger(year) ? year : null;
}

/** Keep only full YYYY-MM-DD dates as an ISO string; partial dates → null. */
function toIsoDate(publishedDate: string | undefined): string | null {
  if (!publishedDate || !/^\d{4}-\d{2}-\d{2}$/.test(publishedDate)) return null;
  const date = new Date(publishedDate);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Google descriptions sometimes carry light HTML; we render them as plain text. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
