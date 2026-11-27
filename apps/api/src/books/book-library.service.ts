import {
  BOOK_SORT_KEYS,
  type BookDetailDto,
  type BookEntryDto,
  type BookItemDto,
  type BookSortKey,
  type BulkEntriesResultDto,
  type BulkEntriesTargetDto,
  type PagedResult,
  type PileSummaryDto,
  type ReadingGoalDto,
  RealtimeEvent,
  SESSION_FILTER_PAUSED,
} from "@loomkeep/shared/contracts";
import {
  type BookOwnershipStatus,
  type BookSource,
  BookStatus,
  Domain,
  ReviewTargetType,
  TrackingCycleStatus,
  XpReason,
} from "@loomkeep/shared/enums";
import { Injectable } from "@nestjs/common";
import type {
  BookExternalId,
  BookItem,
  BookStatus as DbBookStatus,
  Prisma,
} from "@prisma/client";
import { sinceDaysAgo, toDateOrNull, utcDateKey } from "../common/date.util";
import { canonicalExternalId } from "../common/external-id.util";
import { localYear, localYearRange } from "../common/local-day.util";
import { compareTitles, timeMs } from "../common/sort.util";
import { EventsGateway } from "../events/events.gateway";
import { AchievementService } from "../gamification/achievements/achievement.service";
import {
  bookFinishedXp,
  MIN_REWARDED_READING_GOAL,
  readingGoalXp,
  replayXp,
  sagaCompletionXp,
} from "../gamification/xp-rules";
import {
  addToList,
  applyBulkUpdate,
  applyToEntries,
  assertBulkTarget,
  assertBulkUpdate,
} from "../work/bulk-entries.util";
import type {
  EntryStatusChange,
  ListEntriesFilters,
} from "../work/entry-lifecycle.util";
import {
  assertEntryOwnership,
  awardNewEntryXp,
  emitEntryActivity,
  listEntryPage,
  pausedStatusClause,
  polymorphicTargetCleanup,
  RECENTLY_UPDATED_FIRST,
  revokeEntryXp,
  searchTerm,
  syncCycleCompletionXp,
  titleContains,
} from "../work/entry-lifecycle.util";

import { retryAfterUniqueRace } from "../common/prisma-error.util";
import { ACHIEVEMENT_KEYS_BY_XP_REASON } from "../gamification/achievements/triggers";
import { SessionXpService } from "../gamification/session-xp.service";
import { XpService } from "../gamification/xp.service";
import { ListService } from "../lists/list.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
import { ActivityService } from "../social/activity.service";
import {
  BOOK_PILE_STATUSES,
  bookPileItem,
  summarizePile,
} from "../stats/pile.util";
import { AgeGateService } from "../users/age-gate.service";
import { filterAdultContent } from "../users/age.util";
import {
  isLoanActive,
  LOAN_INCLUDE,
  loanFields,
  loanUpdate,
  loanWhere,
  ownershipSourceUpdate,
} from "../work/entry-loan.util";
import { BookItemService } from "./book-item.service";
import { toReadingDto } from "./book-reading.mapper";
import { BookSagaService } from "./book-saga.service";
import type { BulkUpdateBookEntriesBody } from "./dto/bulk-update-book-entries.dto";
import { UpdateBookEntryDto } from "./dto/update-book-entry.dto";
import { UpsertBookEntryDto } from "./dto/upsert-book-entry.dto";
import { UpsertReadingGoalDto } from "./dto/upsert-reading-goal.dto";

// Entries always need the book + its external IDs (canonical sourceId), plus
// its reading history, most recent first.
// How long a reading goal must stand unchanged before meeting it pays XP.
const GOAL_SETTLED_DAYS = 30;

const ENTRY_INCLUDE = {
  bookItem: { include: { externalIds: true } },
  ...LOAN_INCLUDE,
  readings: {
    orderBy: { number: "desc" },
    include: { _count: { select: { sessions: true } } },
  },
  sessions: {
    orderBy: { occurredAt: "desc" },
    take: 1,
    select: { occurredAt: true },
  },
} satisfies Prisma.BookEntryInclude;

/** The shared list filters, plus books anyone can read online for free. */
export interface BookListFilters extends ListEntriesFilters {
  freeToRead?: boolean;
}

type EntryWithBook = Prisma.BookEntryGetPayload<{
  include: typeof ENTRY_INCLUDE;
}>;

const BOOK_STATUS_SORT_ORDER = [
  "TO_READ",
  "READING",
  "READ",
  "DROPPED",
] as const;

/** What ranking a book entry reads — a light slice of its DTO. */
type BookRow = Pick<
  BookEntryDto,
  | "id"
  | "status"
  | "rating"
  | "currentPage"
  | "startedAt"
  | "finishedAt"
  | "createdAt"
> & { book: Pick<BookItemDto, "title" | "authors" | "pageCount"> };

const BOOK_ROW_SELECT = {
  id: true,
  bookItemId: true,
  status: true,
  currentPage: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  bookItem: { select: { title: true, authors: true, pageCount: true } },
} satisfies Prisma.BookEntrySelect;

// The sorts on a stored column, which Postgres pages itself. Unset dates go
// last in the natural (newest first) order, where `timeMs` ranks them. Not
// "pages": an unknown page count ranks as 0, level with a real 0, which
// NULLS LAST would split.
const BOOK_SQL_SORTS: Partial<
  Record<
    BookSortKey,
    (asc: boolean) => Prisma.BookEntryOrderByWithRelationInput[]
  >
> = {
  added: (asc) => [{ createdAt: asc ? "asc" : "desc" }],
  finished: (asc) => [
    {
      finishedAt: { sort: asc ? "asc" : "desc", nulls: asc ? "first" : "last" },
    },
  ],
  started: (asc) => [
    {
      startedAt: { sort: asc ? "asc" : "desc", nulls: asc ? "first" : "last" },
    },
  ],
};

function readPct(e: BookRow): number {
  return e.book.pageCount ? e.currentPage / e.book.pageCount : 0;
}

// Base comparator per criterion (its natural order); `order: "asc"` negates it.
function compareBookEntries(
  sort: BookSortKey,
  a: BookRow,
  b: BookRow,
  locale: string | undefined,
): number {
  switch (sort) {
    case "title":
      return compareTitles(a.book.title, b.book.title, locale);
    case "author":
      return compareTitles(
        a.book.authors[0] ?? "",
        b.book.authors[0] ?? "",
        locale,
      );
    case "rating":
      return (b.rating ?? -1) - (a.rating ?? -1);
    case "pages":
      return (b.book.pageCount ?? 0) - (a.book.pageCount ?? 0);
    case "progress":
      return readPct(b) - readPct(a);
    case "finished":
      return timeMs(b.finishedAt) - timeMs(a.finishedAt);
    case "started":
      return timeMs(b.startedAt) - timeMs(a.startedAt);
    case "status":
      return (
        BOOK_STATUS_SORT_ORDER.indexOf(a.status) -
        BOOK_STATUS_SORT_ORDER.indexOf(b.status)
      );
    case "added":
      return b.createdAt.localeCompare(a.createdAt);
  }
}

@Injectable()
export class BookLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookItemService: BookItemService,
    private readonly ageGate: AgeGateService,
    private readonly reviews: ReviewService,
    private readonly activity: ActivityService,
    private readonly xp: XpService,
    private readonly achievements: AchievementService,
    private readonly events: EventsGateway,
    private readonly lists: ListService,
    private readonly sessionXp: SessionXpService,
    private readonly sagas: BookSagaService,
  ) {}

  /**
   * A finish paid by the work's catalogued length, a reread half that. Not by
   * the edition's page count: the reader types that one, as games are paid
   * by IGDB's time to beat and never by the hours logged.
   */
  private async finishXp(
    bookItemId: string,
    reason: XpReason,
  ): Promise<number> {
    const item = await this.prisma.bookItem.findUnique({
      where: { id: bookItemId },
      select: { pageCount: true },
    });
    const first = bookFinishedXp(item?.pageCount ?? null);
    return reason === XpReason.BOOK_REPLAYED ? replayXp(first) : first;
  }

  /**
   * What finishing a book can complete beyond the book itself: its series
   * (SAGA_COMPLETED, once per series) and the reading goal of the year it was
   * finished (READING_GOAL_REACHED, once per goal).
   */
  private async awardFinishMilestones(
    userId: string,
    bookItemId: string,
    finishedAt: Date | null,
  ): Promise<void> {
    // The year the reader is in when they finish, as for their session days:
    // a book closed on New Year's Eve evening in Paris counts for the new one.
    await this.awardReadingGoal(
      userId,
      localYear(await this.timezoneOf(userId), finishedAt ?? new Date()),
    );

    const item = await this.prisma.bookItem.findUnique({
      where: { id: bookItemId },
      select: { seriesKey: true },
    });
    if (!item?.seriesKey) return;
    const saga = await this.sagas.completed(userId, item.seriesKey);
    if (!saga) return;

    await this.xp.award(
      userId,
      XpReason.SAGA_COMPLETED,
      item.seriesKey,
      sagaCompletionXp(saga.works),
      { title: saga.title, href: "/app/books?vue=sagas", data: {} },
    );
    await this.achievements.evaluate(
      userId,
      ACHIEVEMENT_KEYS_BY_XP_REASON[XpReason.SAGA_COMPLETED],
    );
  }

  /**
   * READING_GOAL_REACHED, sized by the goal — so lowering it to what's
   * already read pays little. A goal must also have stood a month unchanged
   * when it is met: set the day it's reached, it would be a formality.
   */
  private async awardReadingGoal(userId: string, year: number): Promise<void> {
    const goal = await this.prisma.readingGoal.findUnique({
      where: { userId_year: { userId, year } },
    });

    if (
      !goal ||
      goal.target < MIN_REWARDED_READING_GOAL ||
      goal.updatedAt > sinceDaysAgo(new Date(), GOAL_SETTLED_DAYS)
    ) {
      return;
    }

    const completed = await this.countBooksFinishedInYear(userId, year);
    if (completed < goal.target) return;

    await this.xp.award(
      userId,
      XpReason.READING_GOAL_REACHED,
      goal.id,
      readingGoalXp(goal.target),
      {
        title: null,
        href: "/app/books",
        data: { goalTarget: goal.target, goalYear: year },
      },
    );
  }

  /** Emits the status milestone + FAVORITED events for a book entry write. */
  private emitEntryActivity(
    userId: string,
    bookItemId: string,
    change: EntryStatusChange,
  ): Promise<void> {
    return emitEntryActivity(
      this.activity,
      {
        userId,
        domain: Domain.BOOKS,
        targetType: ReviewTargetType.BOOK,
        targetId: bookItemId,
      },
      change,
    );
  }

  /** First touch of a book persists it (on-demand cache), then upserts the entry. */
  async upsertEntry(
    userId: string,
    dto: UpsertBookEntryDto,
  ): Promise<BookEntryDto> {
    const bookItem = await this.bookItemService.upsertFromSource(
      dto.source,
      dto.sourceId,
    );

    const before = await this.prisma.bookEntry.findUnique({
      where: { userId_bookItemId: { userId, bookItemId: bookItem.id } },
      select: { status: true, favorite: true },
    });

    const changes = {
      status: dto.status,
      notes: dto.notes,
      favorite: dto.favorite,
      editionKey: dto.editionKey,
      referencePageCount: dto.referencePageCount,
      ...(dto.status === BookStatus.READ && dto.referencePageCount
        ? {
            currentPage: dto.referencePageCount,
            readingBaselinePage: dto.referencePageCount,
          }
        : {}),
    };
    let entry = await retryAfterUniqueRace(() =>
      this.prisma.bookEntry.upsert({
        where: { userId_bookItemId: { userId, bookItemId: bookItem.id } },
        update: changes,
        create: { userId, bookItemId: bookItem.id, ...changes },
        include: ENTRY_INCLUDE,
      }),
    );

    entry.finishedAt = await this.syncFinishedAt(userId, bookItem.id);
    const statusReading =
      dto.status &&
      before?.status !== dto.status &&
      (before !== null || dto.status !== BookStatus.TO_READ)
        ? await this.syncReadingStatus(entry.id, dto.status)
        : null;

    if (statusReading) {
      entry = await this.prisma.bookEntry.findUniqueOrThrow({
        where: { id: entry.id },
        include: ENTRY_INCLUDE,
      });
    }

    await this.emitEntryActivity(userId, bookItem.id, {
      prevStatus: before?.status ?? null,
      nextStatus: entry.status,
      prevFavorite: before?.favorite ?? false,
      nextFavorite: entry.favorite,
    });

    if (before === null) {
      await awardNewEntryXp(this.xp, {
        userId,
        entryId: entry.id,
        domain: Domain.BOOKS,
        countEntries: () => this.prisma.bookEntry.count({ where: { userId } }),
      });
    }

    if (
      statusReading &&
      (await syncCycleCompletionXp(this.xp, this.achievements, {
        userId,
        previousStatus: before?.status,
        nextStatus: entry.status,
        completedStatus: BookStatus.READ,
        cycle: statusReading,
        sourceType: "BookReading",
        firstReason: XpReason.BOOK_FINISHED,
        replayReason: XpReason.BOOK_REPLAYED,
        amount: (reason) => this.finishXp(entry.bookItemId, reason),
      }))
    ) {
      await this.awardFinishMilestones(
        userId,
        entry.bookItemId,
        statusReading.finishedAt,
      );
    }

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.BOOK,
        bookItem.id,
        dto.rating,
      );
    }

    // add_title/mark_complete are two of the onboarding checklist's steps
    // (see OnboardingService) — pushed unconditionally rather than checking
    // whether onboarding is even still in progress first, since that check
    // would cost as much as the emit is worth avoiding.
    this.events.emitToUser(userId, RealtimeEvent.ONBOARDING_UPDATED);

    return toEntryDto(
      entry,
      await this.reviews.getRating(userId, ReviewTargetType.BOOK, bookItem.id),
    );
  }

  async listEntries(
    userId: string,
    filters: BookListFilters,
  ): Promise<PagedResult<BookEntryDto>> {
    const where = this.entryWhere(userId, filters);
    const ratingsOf = (bookItemIds: string[]) =>
      this.reviews.getRatings(userId, ReviewTargetType.BOOK, bookItemIds);

    return listEntryPage(filters, {
      sortKeys: BOOK_SORT_KEYS,
      defaultSort: "added",
      compare: compareBookEntries,
      sqlSorts: BOOK_SQL_SORTS,
      sqlPage: async (orderBy, skip, take) => {
        const [page, total] = await Promise.all([
          this.prisma.bookEntry.findMany({
            where,
            orderBy: [...orderBy, ...RECENTLY_UPDATED_FIRST],
            skip,
            take,
            select: { id: true },
          }),
          this.prisma.bookEntry.count({ where }),
        ]);
        return { ids: page.map((e) => e.id), total };
      },
      rows: async (sort) => {
        const rows = await this.prisma.bookEntry.findMany({
          where,
          orderBy: RECENTLY_UPDATED_FIRST,
          select: BOOK_ROW_SELECT,
        });
        const ratings =
          sort === "rating"
            ? await ratingsOf(rows.map((r) => r.bookItemId))
            : new Map<string, number>();
        return rows.map((r) => ({
          id: r.id,
          status: r.status,
          rating: ratings.get(r.bookItemId) ?? null,
          currentPage: r.currentPage,
          startedAt: r.startedAt?.toISOString() ?? null,
          finishedAt: r.finishedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
          book: {
            title: r.bookItem.title,
            authors: r.bookItem.authors,
            pageCount: r.bookItem.pageCount,
          },
        }));
      },
      load: async (ids) => {
        const entries = await this.prisma.bookEntry.findMany({
          where: { id: { in: ids } },
          include: ENTRY_INCLUDE,
        });
        const ratings = await ratingsOf(entries.map((e) => e.bookItemId));
        return entries.map((e) =>
          toEntryDto(e, ratings.get(e.bookItemId) ?? null),
        );
      },
    });
  }

  /**
   * Pages left to read among the entries the list would show under the same
   * filters (UX-02). A book with no known page count is left out of the
   * total, and `counted` says so.
   */
  async getPile(
    userId: string,
    filters: BookListFilters,
  ): Promise<PileSummaryDto> {
    const entries = await this.prisma.bookEntry.findMany({
      where: {
        AND: [
          this.entryWhere(userId, filters),
          { status: { in: [...BOOK_PILE_STATUSES] } },
        ],
      },
      select: {
        currentPage: true,
        bookItem: { select: { pageCount: true } },
      },
    });
    return summarizePile(
      "PAGES",
      entries.map((e) => bookPileItem(e.bookItem.pageCount, e.currentPage)),
    );
  }

  /**
   * Applies one change to every targeted entry, each through updateEntry
   * (or the list's addItem), so the side effects match a single update's.
   */
  async bulkUpdate(
    userId: string,
    dto: BulkUpdateBookEntriesBody,
  ): Promise<BulkEntriesResultDto> {
    assertBulkUpdate(dto);
    const entries = await this.prisma.bookEntry.findMany({
      where: this.bulkWhere(userId, dto),
      orderBy: RECENTLY_UPDATED_FIRST,
      select: {
        id: true,
        bookItemId: true,
        status: true,
        favorite: true,
        ownershipStatus: true,
        ownershipSource: true,
      },
    });
    return applyBulkUpdate(
      entries.map((e) => ({ ...e, itemId: e.bookItemId })),
      dto,
      {
        update: (id, patch) =>
          this.updateEntry(userId, id, patch as UpdateBookEntryDto),
        addToList: (itemId, listId) =>
          addToList(this.lists, userId, listId, "BOOK", itemId),
      },
    );
  }

  /** Removes every targeted entry, each through deleteEntry. */
  async bulkDelete(
    userId: string,
    target: BulkEntriesTargetDto,
  ): Promise<BulkEntriesResultDto> {
    assertBulkTarget(target);
    const entries = await this.prisma.bookEntry.findMany({
      where: this.bulkWhere(userId, target),
      select: { id: true },
    });
    return applyToEntries(entries, async (e) => {
      await this.deleteEntry(userId, e.id);
      return true;
    });
  }

  private bulkWhere(
    userId: string,
    target: BulkEntriesTargetDto,
  ): Prisma.BookEntryWhereInput {
    return target.filters
      ? this.entryWhere(userId, target.filters)
      : { userId, id: { in: target.ids ?? [] } };
  }

  private entryWhere(
    userId: string,
    filters: BookListFilters,
  ): Prisma.BookEntryWhereInput {
    const q = searchTerm(filters);
    const statuses = filters.statuses ?? [];
    const persistedStatuses = statuses.filter(
      (status) => status !== SESSION_FILTER_PAUSED,
    ) as DbBookStatus[];
    const statusFilters: Prisma.BookEntryWhereInput[] = [];

    if (persistedStatuses.length > 0) {
      statusFilters.push({ status: { in: persistedStatuses } });
    }

    if (statuses.includes(SESSION_FILTER_PAUSED)) {
      statusFilters.push(pausedStatusClause(BookStatus.READING, new Date()));
    }

    return {
      userId,
      AND: statusFilters.length > 0 ? [{ OR: statusFilters }] : undefined,
      favorite: filters.favorite ? true : undefined,
      ...loanWhere(filters.loan),
      bookItem:
        q || filters.freeToRead
          ? {
              title: q ? titleContains(q) : undefined,
              readOnlineUrl: filters.freeToRead ? { not: null } : undefined,
            }
          : undefined,
    };
  }

  async getEntry(userId: string, entryId: string): Promise<BookEntryDto> {
    const entry = await assertEntryOwnership(userId, () =>
      this.prisma.bookEntry.findUnique({
        where: { id: entryId },
        include: ENTRY_INCLUDE,
      }),
    );
    return toEntryDto(
      entry,
      await this.reviews.getRating(
        userId,
        ReviewTargetType.BOOK,
        entry.bookItemId,
      ),
    );
  }

  async updateEntry(
    userId: string,
    entryId: string,
    dto: UpdateBookEntryDto,
  ): Promise<BookEntryDto> {
    const before = await this.assertEntryOwnership(userId, entryId);

    const completedReading =
      dto.status && before?.status !== dto.status
        ? await this.syncReadingStatus(entryId, dto.status)
        : null;
    const correctedPage =
      dto.status === BookStatus.READ
        ? completedReading?.currentPage
        : undefined;

    const entry = await this.prisma.bookEntry.update({
      where: { id: entryId },
      data: {
        status: dto.status,
        notes: dto.notes,
        favorite: dto.favorite,
        currentPage: dto.currentPage ?? correctedPage,
        readingBaselinePage: dto.currentPage ?? correctedPage,
        editionKey: dto.editionKey,
        referencePageCount: dto.referencePageCount,
        startedAt:
          dto.startedAt === undefined ? undefined : toDateOrNull(dto.startedAt),
        finishedAt:
          dto.finishedAt === undefined
            ? dto.status === BookStatus.READ && before?.finishedAt === null
              ? new Date()
              : undefined
            : toDateOrNull(dto.finishedAt),
        ownershipStatus: dto.ownershipStatus,
        ownershipSource: ownershipSourceUpdate(before.ownershipStatus, dto),
        ...loanUpdate(before, dto),
      },
      include: ENTRY_INCLUDE,
    });

    await this.emitEntryActivity(userId, entry.bookItemId, {
      prevStatus: before?.status ?? null,
      nextStatus: entry.status,
      prevFavorite: before?.favorite ?? false,
      nextFavorite: entry.favorite,
    });

    if (
      completedReading &&
      (await syncCycleCompletionXp(this.xp, this.achievements, {
        userId,
        previousStatus: before?.status,
        nextStatus: entry.status,
        completedStatus: BookStatus.READ,
        cycle: completedReading,
        sourceType: "BookReading",
        firstReason: XpReason.BOOK_FINISHED,
        replayReason: XpReason.BOOK_REPLAYED,
        amount: (reason) => this.finishXp(entry.bookItemId, reason),
      }))
    ) {
      await this.awardFinishMilestones(
        userId,
        entry.bookItemId,
        completedReading.finishedAt,
      );
    }

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.BOOK,
        entry.bookItemId,
        dto.rating,
      );
    }

    this.events.emitToUser(userId, RealtimeEvent.ONBOARDING_UPDATED);

    return toEntryDto(
      entry,
      await this.reviews.getRating(
        userId,
        ReviewTargetType.BOOK,
        entry.bookItemId,
      ),
    );
  }

  /** Reviews and comments are polymorphic and need explicit cleanup. */
  async deleteEntry(userId: string, entryId: string): Promise<void> {
    const entry = await this.assertEntryOwnership(userId, entryId);

    // Loaded before the transaction because readings cascade with the entry.
    const readings = await this.prisma.bookReading.findMany({
      where: { bookEntryId: entryId },
      select: { id: true },
    });
    const sessions = await this.prisma.bookSession.findMany({
      where: { bookEntryId: entryId },
      select: { id: true, createdAt: true },
    });
    // Same reason: the transaction below deletes this Review outright (not
    // via ReviewService, which handles its own XP revocation) —
    // WORK_RATED/REVIEW_WRITTEN/REVIEW_DETAILED would otherwise linger
    // until the next nightly reconciliation.
    const reviews = await this.prisma.review.findMany({
      where: { userId, targetId: entry.bookItemId },
      select: { id: true },
    });

    await this.prisma.$transaction([
      ...polymorphicTargetCleanup(
        this.prisma,
        userId,
        [ReviewTargetType.BOOK],
        [entry.bookItemId],
      ),
      this.prisma.bookEntry.delete({ where: { id: entryId } }),
    ]);

    await revokeEntryXp(this.xp, userId, [
      { sourceType: "Entry", ids: [entryId] },
      { sourceType: "BookReading", ids: readings.map((reading) => reading.id) },
      { sourceType: "Review", ids: reviews.map((r) => r.id) },
    ]);
    await Promise.all(
      sessions.map((session) =>
        this.activity.deleteLinked("BookSession", session.id),
      ),
    );

    for (const session of sessions) {
      await this.sessionXp.refreshAfterDelete(userId, session.createdAt);
    }
  }

  /**
   * Book detail page: catalogue metadata + the user's library state in one
   * call. Served from the cache when the book is already persisted, otherwise
   * fetched live (persisting nothing — a previewed book must not enter the
   * on-demand cache).
   */
  async getBookDetail(
    userId: string,
    source: BookSource,
    sourceId: string,
    lang?: string,
    editionKey?: string,
  ): Promise<BookDetailDto> {
    const details = await this.bookItemService.getLiveDetails(
      source,
      sourceId,
      lang,
      editionKey,
    );
    const allowAdult = await this.ageGate.allowsAdultContent(userId);
    this.ageGate.assertAdultAllowed(details.isAdult, allowAdult);

    details.sameAuthorBooks = filterAdultContent(
      details.sameAuthorBooks,
      allowAdult,
    );

    const ref = await this.prisma.bookExternalId.findUnique({
      where: { source_externalId: { source, externalId: sourceId } },
    });

    return {
      ...details,
      commentTargetId: ref?.bookItemId ?? null,
      entry: ref ? await this.entryFor(userId, ref.bookItemId) : null,
    };
  }

  /**
   * The page's first paint for a book the instance already stores, without
   * calling Open Library: what only the catalogue gives (editions, ratings,
   * same-author books…) stays empty until getBookDetail answers. Null when
   * nobody tracks the book, or when it's an 18+ title the account can't see
   * (getBookDetail says why).
   */
  async getStoredBookDetail(
    userId: string,
    source: BookSource,
    sourceId: string,
  ): Promise<BookDetailDto | null> {
    const ref = await this.prisma.bookExternalId.findUnique({
      where: { source_externalId: { source, externalId: sourceId } },
      include: { bookItem: true },
    });
    if (!ref) return null;

    const item = ref.bookItem;

    if (item.isAdult && !(await this.ageGate.allowsAdultContent(userId))) {
      return null;
    }

    return {
      source,
      sourceId,
      title: item.title,
      authors: item.authors,
      year: item.releaseDate?.getUTCFullYear() ?? null,
      coverUrl: item.coverUrl,
      isAdult: item.isAdult,
      authorRefs: [],
      overview: item.overview,
      subtitle: null,
      publisher: null,
      genres: item.genres,
      pageCount: item.pageCount,
      editionKey: null,
      releaseDate: item.releaseDate ? utcDateKey(item.releaseDate) : null,
      website: null,
      sameAuthorBooks: [],
      ratings: [],
      editionCount: null,
      isbn: item.isbn,
      series: null,
      seriesKey: item.seriesKey,
      language: null,
      firstSentence: null,
      readOnlineUrl: null,
      externalLinks: [],
      commentTargetId: item.id,
      entry: await this.entryFor(userId, item.id),
    };
  }

  private async entryFor(
    userId: string,
    bookItemId: string,
  ): Promise<BookEntryDto | null> {
    const entryRow = await this.prisma.bookEntry.findUnique({
      where: { userId_bookItemId: { userId, bookItemId } },
      include: ENTRY_INCLUDE,
    });
    if (!entryRow) return null;

    return toEntryDto(
      entryRow,
      await this.reviews.getRating(userId, ReviewTargetType.BOOK, bookItemId),
    );
  }

  private assertEntryOwnership(userId: string, entryId: string) {
    return assertEntryOwnership(userId, () =>
      this.prisma.bookEntry.findUnique({
        where: { id: entryId },
        include: LOAN_INCLUDE,
      }),
    );
  }

  private async syncReadingStatus(entryId: string, status: DbBookStatus) {
    const [entry, active] = await Promise.all([
      this.prisma.bookEntry.findUniqueOrThrow({
        where: { id: entryId },
        select: {
          editionKey: true,
          referencePageCount: true,
          readingBaselinePage: true,
          currentPage: true,
        },
      }),
      this.prisma.bookReading.findFirst({
        where: { bookEntryId: entryId, status: TrackingCycleStatus.ACTIVE },
        include: { _count: { select: { sessions: true } } },
      }),
    ]);
    const latest =
      active ??
      (await this.prisma.bookReading.findFirst({
        where: { bookEntryId: entryId },
        orderBy: { number: "desc" },
        include: { _count: { select: { sessions: true } } },
      }));

    if (status === BookStatus.TO_READ) {
      if (active && active._count.sessions === 0) {
        await this.prisma.bookReading.delete({ where: { id: active.id } });
      }

      return null;
    }

    if (status === BookStatus.READING) {
      if (active) return active;

      if (latest) {
        return this.prisma.bookReading.update({
          where: { id: latest.id },
          data: { status: TrackingCycleStatus.ACTIVE, finishedAt: null },
        });
      }

      return this.prisma.bookReading.create({
        data: {
          bookEntryId: entryId,
          number: 1,
          status: TrackingCycleStatus.ACTIVE,
          editionKey: entry.editionKey,
          referencePageCount: entry.referencePageCount,
          baselinePage: entry.readingBaselinePage,
          currentPage: entry.currentPage,
          startedAt: new Date(),
        },
      });
    }

    const target =
      active ??
      latest ??
      (await this.prisma.bookReading.create({
        data: {
          bookEntryId: entryId,
          number: 1,
          status: TrackingCycleStatus.ACTIVE,
          editionKey: entry.editionKey,
          referencePageCount: entry.referencePageCount,
          baselinePage: entry.readingBaselinePage,
          currentPage: entry.currentPage,
          startedAt: new Date(),
        },
      }));
    return this.prisma.bookReading.update({
      where: { id: target.id },
      data: {
        status:
          status === BookStatus.READ
            ? TrackingCycleStatus.COMPLETED
            : TrackingCycleStatus.DROPPED,
        ...(status === BookStatus.READ && target.referencePageCount !== null
          ? { currentPage: target.referencePageCount }
          : {}),
        finishedAt: new Date(),
      },
    });
  }

  /**
   * Keeps `finishedAt` in sync with "has the reader finished this book" —
   * nothing in the UI sets it directly. Mirrors MediaLibraryService.syncFinishedAt
   * for MEDIA; books have no progress model beyond the raw status, so a
   * finished book is simply one marked READ.
   */
  private async syncFinishedAt(
    userId: string,
    bookItemId: string,
  ): Promise<Date | null> {
    const entry = await this.prisma.bookEntry.findUnique({
      where: { userId_bookItemId: { userId, bookItemId } },
      select: { status: true, finishedAt: true },
    });
    if (!entry) return null;

    if (entry.status !== "READ" || entry.finishedAt) return entry.finishedAt;

    const finishedAt = new Date();
    await this.prisma.bookEntry.update({
      where: { userId_bookItemId: { userId, bookItemId } },
      data: { finishedAt },
    });
    return finishedAt;
  }

  /**
   * The user's reading goal for `year` plus their progress: books finished
   * that year (finishedAt-based, regardless of current status — a book
   * reread and put back to READING should stay counted). Every completed
   * BookReading counts once. `target` is 0 with no goal set.
   */
  async getReadingGoal(userId: string, year: number): Promise<ReadingGoalDto> {
    const [goal, completed] = await Promise.all([
      this.prisma.readingGoal.findUnique({
        where: { userId_year: { userId, year } },
      }),
      this.countBooksFinishedInYear(userId, year),
    ]);

    return { year, target: goal?.target ?? 0, completed };
  }

  async upsertReadingGoal(
    userId: string,
    dto: UpsertReadingGoalDto,
  ): Promise<ReadingGoalDto> {
    await this.prisma.readingGoal.upsert({
      where: { userId_year: { userId, year: dto.year } },
      update: { target: dto.target },
      create: { userId, year: dto.year, target: dto.target },
    });

    const completed = await this.countBooksFinishedInYear(userId, dto.year);
    return { year: dto.year, target: dto.target, completed };
  }

  private async timezoneOf(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return user?.timezone ?? "UTC";
  }

  private async countBooksFinishedInYear(
    userId: string,
    year: number,
  ): Promise<number> {
    const range = localYearRange(await this.timezoneOf(userId), year);

    return this.prisma.bookReading.count({
      where: {
        finishedAt: range,
        status: TrackingCycleStatus.COMPLETED,
        bookEntry: { userId },
      },
    });
  }
}

function toBookItemDto(
  book: BookItem & { externalIds: BookExternalId[] },
): BookItemDto {
  return {
    id: book.id,
    title: book.title,
    authors: book.authors,
    coverUrl: book.coverUrl,
    pageCount: book.pageCount,
    canonicalSource: book.canonicalSource,
    sourceId: canonicalExternalId(book, book.externalIds),
  };
}

function toEntryDto(entry: EntryWithBook, rating: number | null): BookEntryDto {
  return {
    id: entry.id,
    book: toBookItemDto(entry.bookItem),
    status: entry.status,
    rating,
    notes: entry.notes,
    favorite: entry.favorite,
    currentPage: entry.currentPage,
    editionKey: entry.editionKey,
    referencePageCount: entry.referencePageCount,
    trackedReadingMinutes: entry.trackedReadingMinutes,
    lastSessionAt: entry.sessions[0]?.occurredAt.toISOString() ?? null,
    startedAt: entry.startedAt?.toISOString() ?? null,
    finishedAt: entry.finishedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    readings: entry.readings.map(toReadingDto),
    ownershipStatus: entry.ownershipStatus as BookOwnershipStatus,
    ownershipSource: entry.ownershipSource,
    ...loanFields(entry),
    loanActive: isLoanActive(entry),
  };
}
