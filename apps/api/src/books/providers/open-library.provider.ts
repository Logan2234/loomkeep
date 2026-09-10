import type { BookEditionDto, RatingDto } from "@loomkeep/shared";
import { BookSource, BookSummaryDto, ErrorCode } from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../../common/app.exception";
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
  "edition_count",
].join(",");

// Same, plus the edition ISBNs the bulk lookup maps its results back through.
// Left out of SEARCH_FIELDS: a work's `isbn` list can run to 700+ entries.
const ISBN_SEARCH_FIELDS = `${SEARCH_FIELDS},isbn`;

// Solr's plain `language`/`isbn`/etc. fields on the *work* doc are aggregated
// across every edition ever catalogued — every translation, every reprint —
// with no way to tell which array entry belongs to which edition. Picking
// e.g. `language[0]` doesn't reliably give the edition being shown; it can
// just as easily surface an unrelated translation's language code.
//
// Instead, `getDetails()` adds a nested `editions` field to the same
// `/search.json` call, combined with `lang=` — Open Library's own relevance
// engine then picks *one concrete edition* matching that language when one
// exists (falling back gracefully otherwise), nested right in the response,
// no extra request needed. Documented at
// https://openlibrary.org/dev/docs/api/search (see "lang" and the editions
// example). Known caveat from upstream: the language match isn't a hard
// filter — `getDetails()` reads `editions.docs[0].language` back from
// whatever edition Open Library actually returned rather than assuming it
// matches `lang`.
const DETAILS_FIELDS = `${SEARCH_FIELDS},editions,editions.key,editions.title,editions.language,editions.isbn,editions.ebook_access`;

// Same trick for search results: the nested edition's own title (in the
// requested language) reads far better than the work's single canonical
// title, which is often the original-language one (e.g. a French reader
// searching would otherwise see "Harry Potter and the Philosopher's Stone").
const SEARCH_FIELDS_WITH_EDITIONS = `${SEARCH_FIELDS},editions,editions.title`;

// Fallback when no caller-supplied language is available (e.g. bulk import).
// `search()`/`getDetails()` accept a `lang` argument for the signed-in user's
// own locale — see `BooksController` for where that's read from.
const DEFAULT_LANG = "en";

// `/works/{id}/editions.json` returns editions newest-catalogued first, not
// grouped or ranked by language — verified against Harry Potter (400
// editions, 49 languages): a limit of 50 only ever surfaces ~15 languages
// (and can miss major ones like French entirely, since which languages got
// a *recent* addition is arbitrary), while 500 in a single request reliably
// surfaces all of them, still bounded to <500 KB even for a 6000-edition
// work (the Bible). Not worth paginating further — one request either way.
const EDITIONS_SCAN_LIMIT = 500;

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
  edition_count?: number;
  // Present only when `editions`/`editions.*` was requested (getDetails()'s
  // DETAILS_FIELDS) — the one edition Solr's `lang=` picked, per the note on
  // DETAILS_FIELDS above.
  editions?: { docs?: OpenLibraryNestedEdition[] };
}

/**
 * The edition nested inside a `/search.json` doc via `editions.*` fields —
 * a much smaller shape than the full `/books/{OLID}.json` record fetched
 * separately for series/first-sentence/cross-reference ids (see
 * `fetchEditionDetail`). Field names are plain strings here (`language`),
 * unlike `/books/{OLID}.json`'s `languages: [{ key }]` — the two endpoints
 * don't share a schema.
 */
interface OpenLibraryNestedEdition {
  key: string; // "/books/OL31900393M".
  title?: string;
  language?: string[]; // ["fre"].
  isbn?: string[];
  ebook_access?: string; // "public" | "borrowable" | "printdisabled" | "no_ebook".
}

interface OpenLibrarySearchResponse {
  numFound: number;
  docs?: OpenLibraryDoc[];
}

/** The body of `/books/{OLID}.json` — one concrete edition, in full. */
interface OpenLibraryEditionDetail {
  key: string; // "/books/OL62190138M".
  title?: string;
  covers?: number[];
  languages?: { key: string }[]; // [{ key: "/languages/eng" }].
  isbn_13?: string[];
  isbn_10?: string[];
  // This edition's own publisher/page count — unlike the work-level Solr
  // doc's `publisher`/`number_of_pages_median`, which are aggregates across
  // every edition ever catalogued (verified: Harry Potter's aggregate
  // `publisher[0]` is literally "J.K. Rowling", not a publisher).
  publishers?: string[];
  number_of_pages?: number;
  // Free-form fallback when `number_of_pages` is absent (~3% of editions;
  // e.g. "245 p.", "396 pages") — present on some editions `number_of_pages`
  // isn't.
  pagination?: string;
  series?: string[];
  // An edition-specific synopsis, when this edition has its own (e.g. a
  // French translation with its own back-cover text) — preferred over the
  // work's single, usually original-language, description when present.
  description?: string | { value?: string };
  // Either a bare string or the `{ type, value }` text object — inconsistent
  // with the plain-string form other Open Library endpoints use elsewhere.
  first_sentence?: string | { value?: string };
  identifiers?: {
    goodreads?: string[];
    librarything?: string[];
    amazon?: string[];
  };
  ocaid?: string; // Internet Archive identifier, when this edition was scanned.
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

/** The body of `/works/{id}/editions.json` — a page of raw edition records. */
interface OpenLibraryEditionsResponse {
  entries?: OpenLibraryEditionDetail[];
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

  /** `lang` (ISO 639-1, e.g. "fr"): the signed-in user's locale, when known. */
  async search(query: string, lang?: string): Promise<BookSummaryDto[]> {
    const data = await this.searchDocs(query, SEARCH_LIMIT, {
      fields: lang ? SEARCH_FIELDS_WITH_EDITIONS : undefined,
      lang,
    });
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

  /**
   * `lang` (ISO 639-1, e.g. "fr"): the signed-in user's locale, when known.
   * `editionKey`: an OLID from `getEditions()` — when given, that exact
   * edition is shown instead of the one `lang` would auto-pick.
   */
  async getDetails(
    sourceId: string,
    lang: string = DEFAULT_LANG,
    editionKey?: string,
  ): Promise<ProviderBookDetails> {
    // A merged work resolves to another id; everything below keys off the
    // canonical one so the cache never stores the stale alias.
    const { id, work } = await this.fetchWork(sourceId);
    // The work document itself carries no page count, publisher or rating —
    // Solr aggregates those across the work's editions, so both are needed.
    // `lang`/`editions.*` (DETAILS_FIELDS) nest one language-matched edition
    // right in this same response — see the note on DETAILS_FIELDS.
    const [doc] = await this.searchDocs(`key:/works/${id}`, 1, {
      fields: DETAILS_FIELDS,
      lang,
    }).catch(() => []);
    const nestedEdition = doc?.editions?.docs?.[0];
    // A manually picked edition overrides Solr's lang-based one; everything
    // edition-specific below then comes straight from the targeted
    // `/books/{OLID}.json` fetch instead of the nested Solr doc, which only
    // ever carries the one edition `lang` matched.
    const pickedOlid = editionKey ?? idFromKey(nestedEdition?.key);
    // One more targeted fetch for the fields the nested doc doesn't carry
    // (description override, series, first sentence, cross-reference ids) —
    // a single `/books/{OLID}.json` call, not a full editions listing.
    const editionDetail = await this.fetchEditionDetail(pickedOlid).catch(
      () => undefined,
    );

    // `editionDetail` is the same picked edition in both the auto-pick and
    // manual-pick paths (it's fetched from `pickedOlid`, not gated on
    // `editionKey`) — so its own title/cover apply either way, not just for
    // an explicit pick.
    const summary = doc
      ? this.toSummary(doc, editionDetail)
      : {
          source: this.source,
          sourceId: id,
          title: editionDetail?.title ?? work.title ?? "Sans titre",
          authors: [],
          year: parseYear(work.first_publish_date),
          coverUrl:
            coverUrl(firstPositiveCover(editionDetail?.covers)) ??
            coverUrl(work.covers?.[0]),
          isAdult: false,
        };

    // Links to the specific, concrete edition rather than the abstract work
    // page — "work" isn't a real book on Open Library, may not be in the
    // requested language, and reads oddly as a rating's destination.
    const bookUrl = pickedOlid
      ? `${API_URL}/books/${pickedOlid}`
      : `${API_URL}/works/${id}`;

    return {
      summary,
      // The edition's own synopsis when it has one (e.g. a translation's
      // back-cover text) — the work's description is usually in whatever
      // language the original cataloger wrote in, not necessarily `lang`.
      overview: description(editionDetail?.description ?? work.description),
      subtitle: work.subtitle ?? doc?.subtitle ?? null,
      // This edition's own publisher/page count, falling back to the Solr
      // work-doc aggregate when the edition record doesn't have one.
      publisher: editionDetail?.publishers?.[0] ?? doc?.publisher?.[0] ?? null,
      genres: displaySubjects(doc?.subject ?? work.subjects ?? []),
      pageCount:
        editionDetail?.number_of_pages ??
        parsePagination(editionDetail?.pagination) ??
        doc?.number_of_pages_median ??
        null,
      releaseDate: toIsoDate(work.first_publish_date),
      website: bookUrl,
      sameAuthorBooks: await this.sameAuthorBooks(id, doc?.author_key?.[0]),
      ratings: toRatings(doc, bookUrl),
      externalIds: [{ source: this.source, externalId: id }],
      editionCount: doc?.edition_count ?? null,
      // The direct `/books/{OLID}.json` fetch (isbn_13/isbn_10) over the
      // Solr-nested doc's `isbn`, which is only populated on the auto-pick
      // path — both point at the same edition either way.
      isbn:
        editionDetail?.isbn_13?.[0] ??
        editionDetail?.isbn_10?.[0] ??
        nestedEdition?.isbn?.[0] ??
        null,
      series: editionDetail?.series?.[0] ?? null,
      language: languageLabel(
        editionLanguageCode(editionDetail) ?? nestedEdition?.language?.[0],
        lang,
      ),
      firstSentence: firstSentenceText(editionDetail?.first_sentence),
      // Solr's `ebook_access` (public vs. borrowable) only comes back on the
      // nested doc from the lang-based auto-pick; a manually picked edition
      // falls back to "has an Internet Archive scan at all", a coarser but
      // reasonable proxy since that field isn't in the raw edition record.
      readOnlineUrl: editionKey
        ? editionDetail?.ocaid
          ? `https://archive.org/details/${editionDetail.ocaid}`
          : null
        : readOnlineUrl(nestedEdition, editionDetail),
      externalLinks: editionExternalLinks(editionDetail),
    };
  }

  /**
   * The distinct editions (by language) available for the manual selector —
   * one entry per language found among the work's catalogued editions,
   * keeping the best-scoring one per language (see `editionScore`) rather
   * than just the first encountered, since `/works/{id}/editions.json`
   * returns editions newest-catalogued first, not ranked by quality — the
   * first one for a language is as likely to be a bare-bones reprint with no
   * cover or synopsis as a well-filled-in record. Editions with no
   * `languages` field at all are skipped — this selector picks a *language*,
   * and an edition that can't be labeled with one is indistinguishable from
   * an already-listed one to a user, not a real alternative.
   */
  async getEditions(
    sourceId: string,
    lang: string = DEFAULT_LANG,
  ): Promise<BookEditionDto[]> {
    // Tried directly first — most works are never merged, so this is 1 call
    // instead of 2. `editions.json` doesn't follow a merged work's redirect
    // itself (verified: 404s on a stale id), so `fetchWork` is only paid for
    // — and its own error left to propagate for a genuinely unknown id —
    // when the direct attempt actually failed.
    let data = await this.fetchEditionsPage(sourceId).catch(() => undefined);

    if (!data) {
      const { id } = await this.fetchWork(sourceId);
      data = await this.fetchEditionsPage(id).catch(() => undefined);
    }

    const byLanguage = new Map<
      string,
      { olid: string; edition: OpenLibraryEditionDetail; score: number }
    >();

    for (const edition of data?.entries ?? []) {
      const olid = idFromKey(edition.key);
      const code = editionLanguageCode(edition);
      if (!olid || !code) continue;

      const score = editionScore(edition);
      const existing = byLanguage.get(code);
      if (existing && existing.score >= score) continue;

      byLanguage.set(code, { olid, edition, score });
    }

    return [...byLanguage.entries()].map(([code, { olid, edition }]) => ({
      key: olid,
      title: edition.title ?? "Sans titre",
      language: languageLabel(code, lang),
      coverUrl: coverUrl(firstPositiveCover(edition.covers)),
    }));
  }

  private fetchEditionsPage(
    workId: string,
  ): Promise<OpenLibraryEditionsResponse> {
    return this.get<OpenLibraryEditionsResponse>(
      `/works/${encodeURIComponent(workId)}/editions.json?limit=${EDITIONS_SCAN_LIMIT}`,
    );
  }

  /** The full record for one edition — series, first sentence, cross-reference ids. */
  private async fetchEditionDetail(
    olid: string | null,
  ): Promise<OpenLibraryEditionDetail | undefined> {
    if (!olid) return undefined;
    return this.get<OpenLibraryEditionDetail>(
      `/books/${encodeURIComponent(olid)}.json`,
    );
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
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.CatalogItemNotFound,
          undefined,
          "Book not found on Open Library",
        );
      }

      const target =
        work.type?.key === "/type/redirect" ? idFromKey(work.location) : null;
      if (!target) return { id, work };

      id = target;
    }

    throw new AppException(
      HttpStatus.NOT_FOUND,
      ErrorCode.CatalogItemNotFound,
      undefined,
      "Book not found on Open Library",
    );
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
      { sort: "rating" },
    ).catch(() => []);

    return docs
      .map((doc) => this.toSummary(doc))
      .filter((b) => b.sourceId !== excludeId)
      .slice(0, MAX_SAME_AUTHOR_BOOKS);
  }

  private async searchDocs(
    query: string,
    limit: number,
    options: { sort?: string; fields?: string; lang?: string } = {},
  ): Promise<OpenLibraryDoc[]> {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      fields: options.fields ?? SEARCH_FIELDS,
    });
    if (options.sort) params.set("sort", options.sort);
    if (options.lang) params.set("lang", options.lang);

    const data = await this.get<OpenLibrarySearchResponse>(
      `/search.json?${params}`,
    );
    return data.docs ?? [];
  }

  private toSummary(
    doc: OpenLibraryDoc,
    editionOverride?: OpenLibraryEditionDetail,
  ): BookSummaryDto {
    return {
      source: this.source,
      sourceId: idFromKey(doc.key) ?? doc.key,
      // A manually picked edition's own title takes priority; otherwise the
      // nested edition's title, when one was requested and found (see
      // SEARCH_FIELDS_WITH_EDITIONS/DETAILS_FIELDS) — closer to the
      // requested language than the work's single canonical title.
      title:
        editionOverride?.title ??
        doc.editions?.docs?.[0]?.title ??
        doc.title ??
        "Sans titre",
      authors: doc.author_name ?? [],
      year: doc.first_publish_year ?? null,
      // The picked edition's own cover, when it has one — a work's `cover_i`
      // is a single default that doesn't follow which edition is shown.
      coverUrl:
        coverUrl(firstPositiveCover(editionOverride?.covers)) ??
        coverUrl(doc.cover_i),
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

    throw new AppException(
      HttpStatus.BAD_GATEWAY,
      ErrorCode.CatalogProviderUnavailable,
      undefined,
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

/**
 * "/works/OL893414W" → "OL893414W", "/books/OL62190138M" → "OL62190138M".
 * Null when there is no id to extract.
 */
function idFromKey(key: string | undefined): string | null {
  const id = key?.split("/").filter(Boolean).pop();
  return id ?? null;
}

function firstSentenceText(
  raw: OpenLibraryEditionDetail["first_sentence"],
): string | null {
  const text = typeof raw === "string" ? raw : raw?.value;
  return text?.trim() || null;
}

/**
 * Where else to find this edition, from its own cross-reference identifiers.
 * Amazon links to a search rather than a direct product page: the ASIN is
 * US-marketplace-specific, and a direct `/dp/` link could 404 or land on the
 * wrong storefront for a reader outside it.
 */
function editionExternalLinks(
  edition: OpenLibraryEditionDetail | undefined,
): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];

  const goodreads = edition?.identifiers?.goodreads?.[0];

  if (goodreads) {
    links.push({
      label: "Goodreads",
      url: `https://www.goodreads.com/book/show/${goodreads}`,
    });
  }

  const librarything = edition?.identifiers?.librarything?.[0];

  if (librarything) {
    links.push({
      label: "LibraryThing",
      url: `https://www.librarything.com/work/${librarything}`,
    });
  }

  const amazonAsin = edition?.identifiers?.amazon?.[0];

  if (amazonAsin) {
    links.push({
      label: "Amazon",
      url: `https://www.amazon.com/s?k=${encodeURIComponent(amazonAsin)}`,
    });
  }

  return links;
}

// `Intl.DisplayNames` translates a language code into the requested UI
// locale on its own — no hand-maintained code→label table to keep in sync,
// and it understands Open Library's ISO 639-2 codes directly (both the
// bibliographic variant it actually returns, e.g. "fre"/"ger"/"chi", and the
// terminology one, e.g. "fra"/"deu"/"zho") in addition to 639-1. Cached per
// locale — constructing one isn't free and `languageLabel` runs in a loop
// over up to `EDITIONS_SCAN_LIMIT` editions.
const displayNamesByLocale = new Map<string, Intl.DisplayNames>();

function languageLabel(code: string | undefined, lang: string): string | null {
  if (!code) return null;

  let displayNames = displayNamesByLocale.get(lang);

  if (!displayNames) {
    displayNames = new Intl.DisplayNames([lang], { type: "language" });
    displayNamesByLocale.set(lang, displayNames);
  }

  // Throws on a code Intl can't parse as a language subtag at all (rare,
  // malformed OL data) — shown as-is rather than hidden, so the edition
  // still displays something.
  try {
    return capitalize(displayNames.of(code) ?? code);
  } catch {
    return code;
  }
}

// A UI label ("Anglais"), not running prose — Intl.DisplayNames follows each
// locale's own convention for language names in a sentence, which for French
// is lowercase ("anglais").
function capitalize(text: string): string {
  return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text;
}

/**
 * How "worth showing" an edition record is, for picking the best one per
 * language in `getEditions()`. Weighted toward `description` — verified
 * that among a language's editions, whichever one happens to be picked has
 * roughly double the chance of carrying its own (translated) synopsis when
 * scored this way instead of just taking the first one found.
 */
function editionScore(edition: OpenLibraryEditionDetail): number {
  let score = 0;
  if (edition.description) score += 3;
  if (firstPositiveCover(edition.covers) !== undefined) score += 2;
  if (edition.number_of_pages) score += 1;
  if (edition.isbn_13?.length) score += 1;
  return score;
}

/** "/languages/eng" (from `/books/{OLID}.json`'s `languages[].key`) → "eng". */
function editionLanguageCode(
  edition: OpenLibraryEditionDetail | undefined,
): string | undefined {
  return idFromKey(edition?.languages?.[0]?.key) ?? undefined;
}

/**
 * A link to read the picked edition online, when Open Library has a fully
 * public scan of it on the Internet Archive. Deliberately excludes
 * "borrowable" — that needs an Internet Archive account and a wait for a
 * lending copy, which isn't the one-click "read online" this link promises.
 */
function readOnlineUrl(
  nestedEdition: OpenLibraryNestedEdition | undefined,
  editionDetail: OpenLibraryEditionDetail | undefined,
): string | null {
  if (nestedEdition?.ebook_access !== "public" || !editionDetail?.ocaid) {
    return null;
  }

  return `https://archive.org/details/${editionDetail.ocaid}`;
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
function toRatings(doc: OpenLibraryDoc | undefined, url: string): RatingDto[] {
  if (!doc?.ratings_average) return [];

  const count = doc.ratings_count ? ` (${doc.ratings_count})` : "";
  const average = Math.round(doc.ratings_average * 10) / 10;
  return [{ source: "Open Library", score: `${average}/5${count}`, url }];
}

/**
 * Built directly, not verified — same approach as the other providers' image
 * URLs. The `-L` variant is ~500px wide, enough for the detail page's hero
 * and downscaled by the browser in poster grids.
 */
function coverUrl(coverId: number | undefined): string | null {
  return coverId ? `${COVERS_URL}/${coverId}-L.jpg` : null;
}

// Some edition records carry a placeholder id (e.g. -1) instead of omitting
// `covers` — covers.openlibrary.org returns a 503 for those, so skip past
// them to the first genuine one rather than emitting a broken image URL.
function firstPositiveCover(covers: number[] | undefined): number | undefined {
  return covers?.find((id) => id > 0);
}

/**
 * Free-form fallback for page count when `number_of_pages` is absent —
 * "245 p.", "396 pages", "288" have all been observed. Null for anything
 * that doesn't start with a number rather than guessing.
 */
function parsePagination(pagination: string | undefined): number | null {
  const match = /^\d+/.exec(pagination ?? "");
  return match ? Number(match[0]) : null;
}

/** A work's description, as either a bare string or a `{ value }` text object. */
function description(raw: OpenLibraryWork["description"]): string | null {
  const text = typeof raw === "string" ? raw : raw?.value;
  if (!text) return null;

  let cleaned = stripHtml(text);
  // Editors often append cross-reference notes ("This work has also been
  // published in multiple volumes. See: ...") after a "---" divider — keep
  // only the synopsis that precedes it.
  const dividerIndex = cleaned.search(/\n\s*-{3,}\s*\n/);
  if (dividerIndex !== -1) cleaned = cleaned.slice(0, dividerIndex);
  // Markdown links ([text](url)) → just the link text; the raw url reads as
  // clutter in a plain-text synopsis.
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();

  return cleaned.length > 0 ? cleaned : null;
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
