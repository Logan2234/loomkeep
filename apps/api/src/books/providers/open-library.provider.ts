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

const API_URL = "https://openlibrary.org";
const COVERS_URL = "https://covers.openlibrary.org/b/id";

// Open Library has no "similar books" endpoint; other works by the primary
// author is the closest equivalent. Capped so the carousel stays a quick
// browse, not an endless scroll.
const MAX_SAME_AUTHOR_BOOKS = 10;

const SEARCH_LIMIT = 20;

// A work's `subject` list can run to hundreds of entries (every subject any
// edition was ever tagged with); only the first few are worth showing.
const MAX_GENRES = 10;

// Past this, a "subject" is a sentence describing the book, not a genre.
const MAX_GENRE_LENGTH = 40;

// Batch size for `searchByIsbns()` — one "isbn:(A OR B OR …)" query per chunk.
// Deliberately small: every matched doc carries its *complete* edition ISBN
// list (700+ entries for a popular work), which is what the mapping back to
// the requested ISBNs needs, so a large batch means a multi-megabyte response.
const ISBN_BATCH_SIZE = 20;

// Solr fields to fetch. Requested explicitly — the default response carries
// dozens of fields (including full-text snippets) we never read.
const SEARCH_FIELDS = [
  "key",
  "title",
  "subtitle",
  "author_name",
  "author_key",
  "first_publish_year",
  "cover_i",
  "number_of_pages_median",
  "publisher",
  "subject",
  "ratings_average",
  "ratings_count",
].join(",");

// Same, plus the edition ISBNs the bulk lookup maps its results back through.
const ISBN_SEARCH_FIELDS = `${SEARCH_FIELDS},isbn`;

/** One Solr document from `/search.json` — a *work*, not an edition. */
interface OpenLibraryDoc {
  key: string; // "/works/OL893414W".
  title?: string;
  subtitle?: string;
  author_name?: string[];
  author_key?: string[]; // "OL79034A" — stable, unlike the display name.
  first_publish_year?: number;
  cover_i?: number; // Cover id, resolved through covers.openlibrary.org.
  number_of_pages_median?: number; // Median across the work's editions.
  publisher?: string[];
  subject?: string[];
  ratings_average?: number; // 1–5.
  ratings_count?: number;
  isbn?: string[]; // Every ISBN across every edition of the work.
}

interface OpenLibrarySearchResponse {
  numFound: number;
  docs?: OpenLibraryDoc[];
}

/**
 * A work document from `/works/{id}.json`. Merged works are served as redirect
 * stubs carrying `type: /type/redirect` + `location` instead of the real body,
 * which is why {@link OpenLibraryProvider.fetchWork} follows them.
 */
interface OpenLibraryWork {
  key?: string;
  title?: string;
  subtitle?: string;
  // Either a bare string or the older `{ type, value }` text object.
  description?: string | { value?: string };
  subjects?: string[];
  covers?: number[];
  first_publish_date?: string;
  type?: { key?: string };
  location?: string;
}

/**
 * Books, from Open Library — the sole book source. Keyless and unmetered,
 * unlike the Google Books API it replaced. Two shapes are used together:
 * `/search.json` (Solr) for search *and* for a work's aggregate metadata
 * (page count, publishers, subjects, rating), and `/works/{id}.json` for the
 * description Solr does not carry.
 */
@Injectable()
export class OpenLibraryProvider implements BookCatalogProvider {
  readonly source = BookSource.OPEN_LIBRARY;

  constructor(
    private readonly configService: ConfigService,
    private readonly quota: QuotaTrackerService,
  ) {}

  async search(query: string): Promise<BookSummaryDto[]> {
    const data = await this.searchDocs(query, SEARCH_LIMIT);
    return data.map((doc) => this.toSummary(doc));
  }

  async searchByIsbn(isbn: string): Promise<BookSummaryDto | null> {
    const [doc] = await this.searchDocs(`isbn:${isbn}`, 1);
    return doc ? this.toSummary(doc) : null;
  }

  /**
   * Resolve many ISBNs in as few requests as possible: chunks of up to
   * {@link ISBN_BATCH_SIZE} joined into one "isbn:(A OR B OR …)" query each,
   * instead of one call per ISBN — a bulk import can carry hundreds of ISBNs.
   * A doc is mapped back to the requested ISBNs through its own edition list.
   * No per-ISBN retry: an ISBN whose chunk request fails is reported in
   * `failedIsbns`, not retried individually.
   */
  async searchByIsbns(isbns: string[]): Promise<{
    matches: Map<string, BookSummaryDto>;
    failedIsbns: string[];
  }> {
    const matches = new Map<string, BookSummaryDto>();
    const failedIsbns: string[] = [];

    for (const batch of chunk(isbns, ISBN_BATCH_SIZE)) {
      try {
        const params = new URLSearchParams({
          q: `isbn:(${batch.join(" OR ")})`,
          limit: String(batch.length),
          fields: ISBN_SEARCH_FIELDS,
        });
        const data = await this.get<OpenLibrarySearchResponse>(
          `/search.json?${params}`,
        );

        for (const doc of data.docs ?? []) {
          const summary = this.toSummary(doc);

          for (const isbn of doc.isbn ?? []) {
            if (batch.includes(isbn) && !matches.has(isbn)) {
              matches.set(isbn, summary);
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
    // A merged work resolves to another id; everything below keys off the
    // canonical one so the cache never stores the stale alias.
    const { id, work } = await this.fetchWork(sourceId);
    // The work document itself carries no page count, publisher or rating —
    // Solr aggregates those across the work's editions, so both are needed.
    const [doc] = await this.searchDocs(`key:/works/${id}`, 1).catch(() => []);

    const summary = doc
      ? this.toSummary(doc)
      : {
          source: this.source,
          sourceId: id,
          title: work.title ?? "Sans titre",
          authors: [],
          year: parseYear(work.first_publish_date),
          coverUrl: coverUrl(work.covers?.[0]),
          isAdult: false,
        };

    return {
      summary,
      overview: description(work.description),
      subtitle: work.subtitle ?? doc?.subtitle ?? null,
      publisher: doc?.publisher?.[0] ?? null,
      genres: displaySubjects(doc?.subject ?? work.subjects ?? []),
      pageCount: doc?.number_of_pages_median ?? null,
      releaseDate: toIsoDate(work.first_publish_date),
      website: `${API_URL}/works/${id}`,
      sameAuthorBooks: await this.sameAuthorBooks(id, doc?.author_key?.[0]),
      ratings: toRatings(doc),
      externalIds: [{ source: this.source, externalId: id }],
    };
  }

  /**
   * Fetch a work, following the redirect stub Open Library serves for works
   * that were merged into another one (a stale id kept as a permalink), and
   * report the id it ultimately resolved to.
   */
  private async fetchWork(
    sourceId: string,
  ): Promise<{ id: string; work: OpenLibraryWork }> {
    let id = sourceId;

    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
      let work: OpenLibraryWork;

      try {
        work = await this.get<OpenLibraryWork>(
          `/works/${encodeURIComponent(id)}.json`,
        );
      } catch {
        throw new NotFoundException("Book not found on Open Library");
      }

      const target =
        work.type?.key === "/type/redirect" ? workId(work.location) : null;
      if (!target) return { id, work };

      id = target;
    }

    throw new NotFoundException("Book not found on Open Library");
  }

  /** Other works by the primary author, excluding this one. */
  private async sameAuthorBooks(
    excludeId: string,
    authorKey: string | undefined,
  ): Promise<BookSummaryDto[]> {
    if (!authorKey) return [];

    // Ranked by rating rather than relevance: with no query term to score
    // against, Solr's default order for an author is essentially arbitrary.
    const docs = await this.searchDocs(
      `author_key:${authorKey}`,
      MAX_SAME_AUTHOR_BOOKS + 1,
      "rating",
    ).catch(() => []);

    return docs
      .map((doc) => this.toSummary(doc))
      .filter((b) => b.sourceId !== excludeId)
      .slice(0, MAX_SAME_AUTHOR_BOOKS);
  }

  private async searchDocs(
    query: string,
    limit: number,
    sort?: string,
  ): Promise<OpenLibraryDoc[]> {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      fields: SEARCH_FIELDS,
    });
    if (sort) params.set("sort", sort);

    const data = await this.get<OpenLibrarySearchResponse>(
      `/search.json?${params}`,
    );
    return data.docs ?? [];
  }

  private toSummary(doc: OpenLibraryDoc): BookSummaryDto {
    return {
      source: this.source,
      sourceId: workId(doc.key) ?? doc.key,
      title: doc.title ?? "Sans titre",
      authors: doc.author_name ?? [],
      year: doc.first_publish_year ?? null,
      coverUrl: coverUrl(doc.cover_i),
      // Open Library carries no maturity rating — see BookSummaryDto.isAdult.
      isAdult: false,
    };
  }

  /**
   * GET an Open Library path. No API key: the usage policy asks for a
   * `User-Agent` identifying the caller instead. Retries transient failures
   * (429 rate limit, 5xx) with backoff — a bulk import can fire hundreds of
   * calls in a burst; honours `Retry-After` when Open Library sends one.
   */
  private async get<T>(path: string): Promise<T> {
    const contact =
      this.configService.get<string>("API_CONTACT") ??
      "self-hosted, no contact provided";
    const url = `${API_URL}${path}`;

    let lastStatus = 0;

    for (let attempt = 1; attempt <= GET_MAX_ATTEMPTS; attempt++) {
      this.quota.record("openLibrary");
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": `Loomkeep/1.0 (${contact})`,
        },
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
      `Open Library request failed with status ${lastStatus}`,
    );
  }
}

const GET_MAX_ATTEMPTS = 3;

// Merged works can chain (A → B → C). Bounded so a cycle can't spin forever.
const MAX_REDIRECT_HOPS = 3;

/** `Retry-After` (seconds) when one is sent; else exponential backoff. */
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

/** "/works/OL893414W" → "OL893414W". Null when there is no id to extract. */
function workId(key: string | undefined): string | null {
  const id = key?.split("/").filter(Boolean).pop();
  return id ?? null;
}

/**
 * Subjects worth showing as genre chips. Open Library's subject list is
 * crowd-sourced and mixes real genres with machine tags
 * ("nyt:mass-market-monthly=2021-11-07"), sentence-long descriptions and
 * case variants of one another — all filtered out here.
 */
function displaySubjects(subjects: string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const subject of subjects) {
    const trimmed = subject.trim();
    const key = trimmed.toLowerCase();

    if (
      trimmed.length === 0 ||
      trimmed.length > MAX_GENRE_LENGTH ||
      /[:=]/.test(trimmed) ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    kept.push(trimmed);
    if (kept.length === MAX_GENRES) break;
  }

  return kept;
}

/** Open Library's own average rating (1–5), when the work has one. */
function toRatings(doc: OpenLibraryDoc | undefined): RatingDto[] {
  if (!doc?.ratings_average) return [];

  const count = doc.ratings_count ? ` (${doc.ratings_count})` : "";
  const average = Math.round(doc.ratings_average * 10) / 10;
  return [{ source: "Open Library", score: `${average}/5${count}` }];
}

/**
 * Built directly, not verified — same approach as the other providers' image
 * URLs. The `-L` variant is ~500px wide, enough for the detail page's hero
 * and downscaled by the browser in poster grids.
 */
function coverUrl(coverId: number | undefined): string | null {
  return coverId ? `${COVERS_URL}/${coverId}-L.jpg` : null;
}

/** A work's description, as either a bare string or a `{ value }` text object. */
function description(raw: OpenLibraryWork["description"]): string | null {
  const text = typeof raw === "string" ? raw : raw?.value;
  if (!text) return null;

  const stripped = stripHtml(text);
  return stripped.length > 0 ? stripped : null;
}

function parseYear(publishDate: string | undefined): number | null {
  const year = Number(/\d{4}/.exec(publishDate ?? "")?.[0]);
  return Number.isInteger(year) ? year : null;
}

/**
 * Keep only full YYYY-MM-DD dates as an ISO string; the free-form dates Open
 * Library carries for older works ("1965", "October 1965") → null.
 */
function toIsoDate(publishDate: string | undefined): string | null {
  if (!publishDate || !/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) return null;
  const date = new Date(publishDate);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Descriptions are user-edited and occasionally carry light HTML; we render
 * them as plain text. Loops the tag-stripping pass until stable — a single
 * pass can leave a tag exposed on a crafted nested/malformed input (e.g.
 * "<<b>script>"), which is exactly what CodeQL's "incomplete multi-character
 * sanitization" check flags.
 */
function stripHtml(html: string): string {
  let result = html;
  let previous: string;

  do {
    previous = result;
    result = previous.replace(/<[^>]*>/g, "");
  } while (result !== previous);

  return result.trim();
}
