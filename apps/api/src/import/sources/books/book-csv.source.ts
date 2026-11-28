import { ErrorCode } from "@loomkeep/shared/catalog";
import type {
  BookSummaryDto,
  ImportMatch,
  ImportPlan,
  ImportPlanGroup,
  ImportPlanItem,
  ImportReport,
  ImportReportTile,
  ImportSource,
} from "@loomkeep/shared/contracts";
import type { BookOwnershipStatus, BookSource } from "@loomkeep/shared/enums";
import { BookStatus, Domain, ReviewTargetType } from "@loomkeep/shared/enums";
import assert from "node:assert/strict";
import { BookEntryImportWriter } from "../../../books/book-entry-import.writer";
import { BookItemService } from "../../../books/book-item.service";
import { AppException } from "../../../common/app.exception";
import { mapWithConcurrency, refKey } from "../../../common/concurrency.util";
import { PrismaService } from "../../../prisma/prisma.service";
import { ReviewService } from "../../../reviews/review.service";
import { AgeGateService } from "../../../users/age-gate.service";
import {
  type CommitDecisions,
  type ImportReq,
  type ProgressReporter,
  indexPlanMatches,
  pickStatus,
} from "../../import-source";

/** writeBook's answer for a book the catalogue no longer knows. */
const NOT_FOUND = Symbol("not found");

// Rows are resolved against the catalogue a few at a time — fast enough for a
// typical export while staying polite to the Open Library API.
const RESOLVE_CONCURRENCY = 5;

/** Review sections, in display order: the client labels each status. */
const STATUS_GROUPS: BookStatus[] = ["READING", "TO_READ", "READ", "DROPPED"];

/**
 * The subset of a parsed CSV row every book importer produces. A concrete
 * source's row type may narrow `startedAt` (Goodreads has no start column, so
 * it is always null) — everything else is common.
 */
export interface ParsedCsvBookRow {
  title: string;
  authors: string[];
  /** ISBN-10/13 when the row carries one; null otherwise. */
  isbn: string | null;
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  ownershipStatus: BookOwnershipStatus;
  readCount: number;
}

/** A resolved row: its parse data, the catalogue match, and how it resolved. */
interface ResolvedRow<TRow> {
  key: string;
  row: TRow;
  summary: BookSummaryDto | null;
  apiError: boolean;
}

/**
 * Shared mechanics of a CSV book import (Goodreads, StoryGraph, and future
 * sources) as an {@link ImportReq}: parse → resolve every row against Open
 * Library (writing nothing) → persist the chosen books on commit. A concrete
 * source only supplies its {@link ImportReq.id} and {@link parseCsv}; the
 * resolve/plan/commit flow lives here so a new source never re-implements it.
 *
 * Generic over `TRow` (the source's parsed row); the parse model carried on the
 * job between analyze and commit is simply `TRow[]`, keyed by original index.
 */
export abstract class BookCsvSource<
  TRow extends ParsedCsvBookRow,
> implements ImportReq<TRow[]> {
  abstract readonly id: ImportSource;
  readonly searchDomain = Domain.BOOKS;
  readonly supportsOverwrite = true;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly bookItemService: BookItemService,
    protected readonly ageGate: AgeGateService,
    protected readonly reviews: ReviewService,
  ) {
    this.entryWriter = new BookEntryImportWriter(prisma);
  }

  /** The books module's writes: an import never writes its tables itself. */
  protected readonly entryWriter: BookEntryImportWriter;

  /** Source-specific: parse the raw export CSV into normalised rows. */
  protected abstract parseCsv(csv: string): TRow[];

  parseInput(input: string): TRow[] {
    return this.parseCsv(input);
  }

  async buildPlan(
    userId: string,
    rows: TRow[],
    progress: ProgressReporter,
  ): Promise<ImportPlan> {
    progress.setTotal(rows.length);
    const resolved = await this.resolveRows(rows, progress);

    const summaries = resolved
      .map((r) => r.summary)
      .filter((s): s is BookSummaryDto => s !== null);
    const [inLibrary, allowAdult] = await Promise.all([
      this.trackedKeys(userId, summaries),
      this.ageGate.allowsAdultContent(userId),
    ]);

    // One bucket per status, keyed by the CSV's own status for the row.
    const byStatus = new Map<BookStatus, ImportPlanItem[]>();
    let matched = 0;
    let unresolved = 0;
    let apiErrors = 0;

    for (const { key, row, summary, apiError } of resolved) {
      // Never surface a restricted title for import on a non-opted-in account.
      if (summary && summary.isAdult && !allowAdult) continue;

      const alreadyInLibrary = summary
        ? inLibrary.has(refKey(summary.source, summary.sourceId))
        : false;
      const match = summary ? toMatch(summary) : null;
      if (match) matched++;
      else unresolved++;
      if (apiError) apiErrors++;

      const item: ImportPlanItem = {
        key,
        title: summary?.title ?? row.title,
        sourceTitle: row.title,
        context: { kind: "book", rating: row.rating },
        coverUrl: summary?.coverUrl ?? null,
        match,
        include: match !== null && !alreadyInLibrary,
        alreadyInLibrary,
        defaultStatus: row.status,
        apiError,
      };
      const bucket = byStatus.get(row.status) ?? [];
      bucket.push(item);
      byStatus.set(row.status, bucket);
    }

    const groups: ImportPlanGroup[] = STATUS_GROUPS.flatMap((status) => {
      const items = byStatus.get(status);
      return items?.length ? [{ id: status, items }] : [];
    });

    return {
      groups,
      counts: { total: matched + unresolved, matched, unresolved, apiErrors },
      searchDomain: Domain.BOOKS,
    };
  }

  async commit(
    userId: string,
    rows: TRow[],
    plan: ImportPlan,
    decisions: CommitDecisions,
    progress: ProgressReporter,
  ): Promise<ImportReport> {
    const matchByKey = indexPlanMatches(plan);
    const allowAdult = await this.ageGate.allowsAdultContent(userId);

    const tally = new Map<BookStatus, number>();
    let notFound = 0;
    // Overwrite replaces book by book (see writeBook), and drops the books
    // the export doesn't cover only once every one is written: a failure or
    // a restart mid-way never costs a book not yet rewritten.
    const written = new Set<string>();

    for (const key of decisions.include) {
      const index = rowIndex(key);
      const row = index === null ? undefined : rows[index];
      const match = decisions.overrides.get(key) ?? matchByKey.get(key);

      if (!row || !match) {
        progress.tick();
        continue;
      }

      const status = pickStatus(
        BookStatus,
        row.status,
        decisions.statuses.get(key),
      );
      const bookItemId = await this.writeBook(
        userId,
        match.source as BookSource,
        match.sourceId,
        status,
        row,
        allowAdult,
        decisions.overwrite && written,
      );

      if (bookItemId === NOT_FOUND) {
        notFound++;
      } else if (bookItemId) {
        written.add(bookItemId);
        tally.set(status, (tally.get(status) ?? 0) + 1);
      }

      progress.tick();
    }

    // Nothing written replaces nothing, rather than emptying the library.
    if (decisions.overwrite && written.size > 0) {
      // Reading cycles cascade on BookEntry delete.
      await this.entryWriter.removeAllExcept(userId, [...written]);
    }

    const tiles: ImportReportTile[] = STATUS_GROUPS.flatMap((status) => {
      const value = tally.get(status);
      return value !== undefined && value > 0 ? [{ id: status, value }] : [];
    });

    if (tiles.length === 0) tiles.push({ id: "books", value: 0 });
    if (notFound > 0) tiles.push({ id: "notFound", value: notFound });

    return { overwrite: decisions.overwrite, tiles };
  }

  private async hasRating(
    userId: string,
    bookItemId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.review.findUnique({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType: ReviewTargetType.BOOK,
          targetId: bookItemId,
        },
      },
      select: { id: true },
    });
    return existing !== null;
  }

  /**
   * Fetch details, persist the book, and upsert the entry: its book id, or
   * null if skipped. Under overwrite its previous entry (and reading cycles)
   * goes first, so the import's own replaces it whole.
   */
  private async writeBook(
    userId: string,
    source: BookSource,
    sourceId: string,
    status: BookStatus,
    row: TRow,
    allowAdult: boolean,
    replace: { has(id: string): boolean } | false,
  ): Promise<string | typeof NOT_FOUND | null> {
    // Only "the catalogue no longer has it" is skipped: an outage fails the
    // import (no free quota spent, the same analysis can be run again)
    // instead of dropping the book while the run counts as a success.
    const details = await this.bookItemService
      .providerFor()
      .getStoredDetails(sourceId)
      .catch((err: unknown) => {
        if (
          err instanceof AppException &&
          err.code === ErrorCode.CatalogItemNotFound
        ) {
          return null;
        }

        throw err;
      });
    if (!details) return NOT_FOUND;
    // Guard the commit too: the client sends its own list of ids.
    if (details.summary.isAdult && !allowAdult) return null;

    const bookItem = await this.bookItemService.persistDetails(source, details);

    if (replace && !replace.has(bookItem.id)) {
      await this.entryWriter.removeTitle(userId, bookItem.id);
    }

    // A finished book with a known length reads as fully progressed.
    const currentPage =
      status === "READ" && details.pageCount ? details.pageCount : 0;

    const data = {
      status,
      notes: row.notes,
      currentPage,
      editionKey: details.editionKey,
      referencePageCount: details.pageCount,
      readingBaselinePage: currentPage,
      startedAt: row.startedAt ? new Date(row.startedAt) : null,
      finishedAt: row.finishedAt ? new Date(row.finishedAt) : null,
      ownershipStatus: row.ownershipStatus,
    };
    // Only a first-time import backfills reading cycles from "Read Count".
    const existing = await this.entryWriter.findForMerge(userId, bookItem.id);
    const entry = await this.entryWriter.write(
      userId,
      bookItem.id,
      existing,
      data,
    );

    // The rating now lives in Review (the single source of truth). One the
    // user already gave stays, as for media.
    if (row.rating !== null && !(await this.hasRating(userId, bookItem.id))) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.BOOK,
        bookItem.id,
        row.rating,
      );
    }

    if (!existing && status !== "TO_READ") {
      const count = status === "READ" ? Math.max(1, row.readCount) : 1;
      await this.entryWriter.backfillReadings(
        Array.from({ length: count }, (_, index) => ({
          bookEntryId: entry.id,
          number: index + 1,
          status:
            status === "READ"
              ? ("COMPLETED" as const)
              : status === "DROPPED"
                ? ("DROPPED" as const)
                : ("ACTIVE" as const),
          editionKey: details.editionKey,
          referencePageCount: details.pageCount,
          baselinePage: index === 0 ? currentPage : 0,
          currentPage: status === "READ" ? currentPage : 0,
          startedAt: row.startedAt ? new Date(row.startedAt) : null,
          // No date from the source stays no date: "today" put a whole
          // imported library in this year's stats and reading goal.
          finishedAt:
            status === "READ" && row.finishedAt
              ? new Date(row.finishedAt)
              : null,
          legacyIncomplete: count > 1,
        })),
      );
    }

    return bookItem.id;
  }

  /**
   * Resolve every row against Open Library — writing nothing. Rows with an
   * ISBN are resolved together in a handful of batched calls; the rest fall
   * back to an individual title+author search. Progress ticks once per row.
   */
  private async resolveRows(
    rows: TRow[],
    progress: ProgressReporter,
  ): Promise<ResolvedRow<TRow>[]> {
    const withKeys = rows.map((row, i) => ({ key: `b${i}`, row }));
    const isbnRows = withKeys.filter((r) => r.row.isbn !== null);
    const queryRows = withKeys.filter((r) => r.row.isbn === null);

    const uniqueIsbns = Array.from(
      new Set(isbnRows.map((r) => r.row.isbn as string)),
    );
    const { matches, failedIsbns } =
      await this.bookItemService.resolveByIsbns(uniqueIsbns);
    const failedIsbnSet = new Set(failedIsbns);

    const isbnResolved: ResolvedRow<TRow>[] = isbnRows.map(({ key, row }) => {
      const summary = matches.get(row.isbn as string) ?? null;
      progress.tick();
      return {
        key,
        row,
        summary,
        apiError: summary === null && failedIsbnSet.has(row.isbn as string),
      };
    });

    const queryResolved = await mapWithConcurrency(
      queryRows,
      RESOLVE_CONCURRENCY,
      async ({ key, row }) => {
        const resolved = await this.resolveByQuery(row);
        progress.tick();
        return { key, row, ...resolved };
      },
    );

    const byKey = new Map(
      [...isbnResolved, ...queryResolved].map((r) => [r.key, r]),
    );
    return withKeys.map(({ key }) => {
      const resolved = byKey.get(key);
      assert(resolved, "Every input row must have a resolution result");
      return resolved;
    });
  }

  /**
   * Resolve a row that has no ISBN by a title+author search. An API failure
   * (rate limit, outage) is reported as `apiError` instead of a plain "not
   * found", so the plan can tell the two apart.
   */
  private async resolveByQuery(
    row: TRow,
  ): Promise<{ summary: BookSummaryDto | null; apiError: boolean }> {
    const query = [row.title, row.authors[0]].filter(Boolean).join(" ");

    try {
      const summary = await this.bookItemService.resolve(null, query);
      return { summary, apiError: false };
    } catch {
      return { summary: null, apiError: true };
    }
  }

  /** `source|externalId` keys (of the given set) the user already tracks. */
  private async trackedKeys(
    userId: string,
    summaries: BookSummaryDto[],
  ): Promise<Set<string>> {
    if (summaries.length === 0) return new Set();

    const externalIds = summaries.map((s) => s.sourceId);
    const wanted = new Set(summaries.map((s) => refKey(s.source, s.sourceId)));
    const refs = await this.prisma.bookExternalId.findMany({
      where: { externalId: { in: externalIds } },
      select: { source: true, externalId: true, bookItemId: true },
    });
    const relevant = refs.filter((r) =>
      wanted.has(refKey(r.source, r.externalId)),
    );
    const entries = await this.prisma.bookEntry.findMany({
      where: { userId, bookItemId: { in: relevant.map((r) => r.bookItemId) } },
      select: { bookItemId: true },
    });
    const owned = new Set(entries.map((e) => e.bookItemId));
    return new Set(
      relevant
        .filter((r) => owned.has(r.bookItemId))
        .map((r) => refKey(r.source, r.externalId)),
    );
  }
}

function toMatch(summary: BookSummaryDto): ImportMatch {
  return {
    source: summary.source,
    sourceId: summary.sourceId,
    title: summary.title,
    year: summary.year,
    coverUrl: summary.coverUrl,
  };
}

function rowIndex(key: string): number | null {
  const m = /^b(\d+)$/.exec(key);
  return m ? Number(m[1]) : null;
}
