import type {
  BookOwnershipStatus,
  BookSource,
  BookStatus,
  BookSummaryDto,
  ImportMatch,
  ImportPlan,
  ImportPlanGroup,
  ImportPlanItem,
  ImportReport,
  ImportReportTile,
  ImportSource,
} from "@loomkeep/shared";
import { Domain, ReviewTargetType } from "@loomkeep/shared";
import { BookItemService } from "../../../books/book-item.service";
import { mapWithConcurrency, refKey } from "../../../common/concurrency.util";
import { PrismaService } from "../../../prisma/prisma.service";
import { ReviewService } from "../../../reviews/review.service";
import { AgeGateService } from "../../../users/age-gate.service";
import type {
  CommitDecisions,
  ImportReq,
  ProgressReporter,
} from "../../import-source";

// Rows are resolved against the catalogue a few at a time — fast enough for a
// typical export while staying polite to the Open Library API.
const RESOLVE_CONCURRENCY = 5;

/** Review sections, in display order, with their French headings. */
const STATUS_GROUPS: { status: BookStatus; label: string }[] = [
  { status: "READING", label: "En lecture" },
  { status: "TO_READ", label: "À lire" },
  { status: "READ", label: "Lus" },
  { status: "DROPPED", label: "Abandonnés" },
];

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
  ) {}

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
        subtitle: row.rating !== null ? `★ ${row.rating}/10` : null,
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

    const groups: ImportPlanGroup[] = STATUS_GROUPS.filter(
      (g) => (byStatus.get(g.status)?.length ?? 0) > 0,
    ).map((g) => ({
      id: g.status,
      label: g.label,
      items: byStatus.get(g.status)!,
    }));

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

    if (decisions.overwrite) {
      // BookReplay cascades on BookEntry delete (schema onDelete: Cascade).
      await this.prisma.bookEntry.deleteMany({ where: { userId } });
    }

    // Tally imported books by their final status → one report tile per status.
    const tally = new Map<BookStatus, number>();

    for (const key of decisions.include) {
      const index = rowIndex(key);
      const row = index === null ? undefined : rows[index];
      const match = decisions.overrides.get(key) ?? matchByKey.get(key);

      if (!row || !match) {
        progress.tick();
        continue;
      }

      const status = (decisions.statuses.get(key) ?? row.status) as BookStatus;
      const written = await this.writeBook(
        userId,
        match.source as BookSource,
        match.sourceId,
        status,
        row,
        allowAdult,
      );
      if (written) tally.set(status, (tally.get(status) ?? 0) + 1);
      progress.tick();
    }

    const tiles: ImportReportTile[] = STATUS_GROUPS.filter(
      (g) => (tally.get(g.status) ?? 0) > 0,
    ).map((g) => ({
      id: g.status,
      label: g.label,
      value: tally.get(g.status)!,
      sub: null,
    }));

    if (tiles.length === 0) {
      tiles.push({ id: "books", label: "Livres", value: 0, sub: null });
    }

    return { overwrite: decisions.overwrite, tiles };
  }

  /** Fetch details, persist the book, and upsert the entry. False if skipped. */
  private async writeBook(
    userId: string,
    source: BookSource,
    sourceId: string,
    status: BookStatus,
    row: TRow,
    allowAdult: boolean,
  ): Promise<boolean> {
    const details = await this.bookItemService
      .providerFor()
      .getDetails(sourceId)
      .catch(() => null);
    if (!details) return false;
    // Guard the commit too: the client sends its own list of ids.
    if (details.summary.isAdult && !allowAdult) return false;

    const bookItem = await this.bookItemService.persistDetails(source, details);
    // A finished book with a known length reads as fully progressed.
    const currentPage =
      status === "READ" && details.pageCount ? details.pageCount : 0;

    const data = {
      status,
      notes: row.notes,
      currentPage,
      startedAt: row.startedAt ? new Date(row.startedAt) : null,
      finishedAt: row.finishedAt ? new Date(row.finishedAt) : null,
      ownershipStatus: row.ownershipStatus,
    };
    // Only a first-time import backfills replays from "Read Count" — an
    // existing entry may already have its own, and re-running the same import
    // shouldn't keep piling more on.
    const existing = await this.prisma.bookEntry.findUnique({
      where: { userId_bookItemId: { userId, bookItemId: bookItem.id } },
      select: { id: true },
    });
    const entry = await this.prisma.bookEntry.upsert({
      where: { userId_bookItemId: { userId, bookItemId: bookItem.id } },
      update: data,
      create: { userId, bookItemId: bookItem.id, ...data },
    });

    // The rating now lives in Review (the single source of truth).
    if (row.rating !== null) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.BOOK,
        bookItem.id,
        row.rating,
      );
    }

    if (!existing && row.readCount > 1) {
      await this.prisma.bookReplay.createMany({
        data: Array.from({ length: row.readCount - 1 }, () => ({
          bookEntryId: entry.id,
          finishedAt: row.finishedAt ? new Date(row.finishedAt) : new Date(),
        })),
      });
    }

    return true;
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

    // Restore the CSV's original row order for the review list.
    const byKey = new Map(
      [...isbnResolved, ...queryResolved].map((r) => [r.key, r]),
    );
    return withKeys.map(({ key }) => byKey.get(key)!);
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

/** Flatten a plan's auto-resolved matches into a key → match lookup. */
function indexPlanMatches(plan: ImportPlan): Map<string, ImportMatch> {
  const byKey = new Map<string, ImportMatch>();

  for (const group of plan.groups) {
    for (const item of group.items) {
      if (item.match) byKey.set(item.key, item.match);
    }
  }

  return byKey;
}

/** Parse the row index out of a `b{i}` plan key. */
function rowIndex(key: string): number | null {
  const m = /^b(\d+)$/.exec(key);
  return m ? Number(m[1]) : null;
}
