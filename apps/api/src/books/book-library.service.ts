import {
  type BookDetailDto,
  type BookEntryDto,
  type BookItemDto,
  type BookSource,
  type BulkEntriesResultDto,
  type BulkEntriesTargetDto,
  type PagedResult,
  type PileSummaryDto,
  type ReadingGoalDto,
  BookStatus,
  Domain,
  DORMANT_AFTER_DAYS,
  ReviewTargetType,
  TrackingCycleStatus,
  XpReason,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import type {
  BookExternalId,
  BookItem,
  BookStatus as DbBookStatus,
  Prisma,
} from "@prisma/client";
import {
  addToList,
  applyBulkUpdate,
  applyToEntries,
  assertBulkTarget,
  assertBulkUpdate,
} from "../common/bulk-entries.util";
import { sinceDaysAgo, toDateOrNull, utcYearRange } from "../common/date.util";
import type {
  EntryStatusChange,
  ListEntriesFilters,
} from "../common/entry-lifecycle.util";
import {
  assertEntryOwnership,
  awardNewEntryXp,
  emitEntryActivity,
  listEntryPage,
  polymorphicTargetCleanup,
  RECENTLY_UPDATED_FIRST,
  searchTerm,
  titleContains,
} from "../common/entry-lifecycle.util";
import { canonicalExternalId } from "../common/external-id.util";
import { compareTitles, timeMs } from "../common/sort.util";
import { EventsGateway } from "../events/events.gateway";
import { AchievementService } from "../gamification/achievements/achievement.service";
import { ACHIEVEMENT_KEYS_BY_XP_REASON } from "../gamification/achievements/registry";
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
import { BookItemService } from "./book-item.service";
import { toReadingDto } from "./book.mappers";
import type { BulkUpdateBookEntriesBody } from "./dto/bulk-update-book-entries.dto";
import { UpdateBookEntryDto } from "./dto/update-book-entry.dto";
import { UpsertBookEntryDto } from "./dto/upsert-book-entry.dto";
import { UpsertReadingGoalDto } from "./dto/upsert-reading-goal.dto";

// Entries always need the book + its external IDs (canonical sourceId), plus
// its reading history, most recent first.
const ENTRY_INCLUDE = {
  bookItem: { include: { externalIds: true } },
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

type EntryWithBook = Prisma.BookEntryGetPayload<{
  include: typeof ENTRY_INCLUDE;
}>;

type BookSortKey =
  | "added"
  | "title"
  | "author"
  | "rating"
  | "pages"
  | "progress"
  | "finished"
  | "started"
  | "status";
const BOOK_SORT_KEYS = [
  "added",
  "title",
  "author",
  "rating",
  "pages",
  "progress",
  "finished",
  "started",
  "status",
] as const satisfies readonly BookSortKey[];
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
    private readonly sessionXp?: SessionXpService,
  ) {}

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
    let entry = await this.prisma.bookEntry.upsert({
      where: { userId_bookItemId: { userId, bookItemId: bookItem.id } },
      update: changes,
      create: { userId, bookItemId: bookItem.id, ...changes },
      include: ENTRY_INCLUDE,
    });

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

    if (
      before?.status === BookStatus.READ &&
      entry.status !== BookStatus.READ &&
      statusReading
    ) {
      await this.xp.revokeBySource("BookReading", [statusReading.id]);
    }

    if (before === null) {
      await awardNewEntryXp(this.xp, {
        userId,
        entryId: entry.id,
        domain: Domain.BOOKS,
        countEntries: () => this.prisma.bookEntry.count({ where: { userId } }),
      });
    }

    if (
      before?.status !== BookStatus.READ &&
      entry.status === BookStatus.READ &&
      statusReading
    ) {
      const reason =
        statusReading.number === 1
          ? XpReason.BOOK_FINISHED
          : XpReason.BOOK_REPLAYED;
      await this.xp.award(userId, reason, statusReading.id);
      await this.achievements.evaluate(
        userId,
        ACHIEVEMENT_KEYS_BY_XP_REASON[reason],
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
    this.events.emitToUser(userId, "onboarding-updated");

    return toEntryDto(
      entry,
      await this.reviews.getRating(userId, ReviewTargetType.BOOK, bookItem.id),
    );
  }

  async listEntries(
    userId: string,
    filters: ListEntriesFilters,
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
    filters: ListEntriesFilters,
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
    filters: ListEntriesFilters,
  ): Prisma.BookEntryWhereInput {
    const q = searchTerm(filters);
    const statuses = filters.statuses ?? [];
    const persistedStatuses = statuses.filter(
      (status) => status !== "PAUSED",
    ) as DbBookStatus[];
    const statusFilters: Prisma.BookEntryWhereInput[] = [];

    if (persistedStatuses.length > 0) {
      statusFilters.push({ status: { in: persistedStatuses } });
    }

    if (statuses.includes("PAUSED")) {
      const cutoff = sinceDaysAgo(new Date(), DORMANT_AFTER_DAYS);
      statusFilters.push({
        status: BookStatus.READING,
        sessions: {
          some: { occurredAt: { lt: cutoff } },
          none: { occurredAt: { gte: cutoff } },
        },
      });
    }

    return {
      userId,
      AND: statusFilters.length > 0 ? [{ OR: statusFilters }] : undefined,
      favorite: filters.favorite ? true : undefined,
      bookItem: q ? { title: titleContains(q) } : undefined,
    };
  }

  async getEntry(userId: string, entryId: string): Promise<BookEntryDto> {
    await this.assertEntryOwnership(userId, entryId);
    const entry = await this.prisma.bookEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: ENTRY_INCLUDE,
    });
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
    await this.assertEntryOwnership(userId, entryId);

    const before = await this.prisma.bookEntry.findUnique({
      where: { id: entryId },
      select: { status: true, favorite: true, finishedAt: true },
    });

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
        ownershipSource: dto.ownershipSource,
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
      before?.status === BookStatus.READ &&
      entry.status !== BookStatus.READ &&
      completedReading
    ) {
      await this.xp.revokeBySource("BookReading", [completedReading.id]);
    }

    if (
      before?.status !== BookStatus.READ &&
      entry.status === BookStatus.READ &&
      completedReading
    ) {
      const reason =
        completedReading.number === 1
          ? XpReason.BOOK_FINISHED
          : XpReason.BOOK_REPLAYED;
      await this.xp.award(userId, reason, completedReading.id);
      await this.achievements.evaluate(
        userId,
        ACHIEVEMENT_KEYS_BY_XP_REASON[reason],
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

    this.events.emitToUser(userId, "onboarding-updated");

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
      ...polymorphicTargetCleanup(this.prisma, userId, [entry.bookItemId]),
      this.prisma.bookEntry.delete({ where: { id: entryId } }),
    ]);

    await this.xp.revokeBySource("BookEntry", [entryId]); // BOOK_FINISHED
    await this.xp.revokeBySource("Entry", [entryId]); // WORK_ADDED
    await this.xp.revokeBySource(
      "BookReading",
      readings.map((reading) => reading.id),
    );
    await this.xp.revokeBySource(
      "Review",
      reviews.map((r) => r.id),
    ); // WORK_RATED / REVIEW_WRITTEN / REVIEW_DETAILED
    await Promise.all(
      sessions.map((session) =>
        this.activity.deleteLinked("BookSession", session.id),
      ),
    );

    if (this.sessionXp) {
      for (const session of sessions) {
        await this.sessionXp.refreshAfterDelete(userId, session.createdAt);
      }
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
    const entryRow = ref
      ? await this.prisma.bookEntry.findUnique({
          where: {
            userId_bookItemId: { userId, bookItemId: ref.bookItemId },
          },
          include: ENTRY_INCLUDE,
        })
      : null;

    return {
      ...details,
      commentTargetId: ref?.bookItemId ?? null,
      entry: entryRow
        ? toEntryDto(
            entryRow,
            await this.reviews.getRating(
              userId,
              ReviewTargetType.BOOK,
              entryRow.bookItemId,
            ),
          )
        : null,
    };
  }

  private assertEntryOwnership(userId: string, entryId: string) {
    return assertEntryOwnership(userId, () =>
      this.prisma.bookEntry.findUnique({ where: { id: entryId } }),
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
   * nothing in the UI sets it directly. Mirrors LibraryService.syncFinishedAt
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

  private async countBooksFinishedInYear(
    userId: string,
    year: number,
  ): Promise<number> {
    const range = utcYearRange(year);

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
    ownershipStatus: entry.ownershipStatus,
    ownershipSource: entry.ownershipSource,
  };
}
