import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  BookEntry,
  BookExternalId,
  BookItem,
  BookReplay,
  BookStatus as DbBookStatus,
  Prisma,
} from "@prisma/client";
import type {
  BookDetailDto,
  BookEntryDto,
  BookItemDto,
  BookReplayDto,
  BookSource,
  PagedResult,
} from "@loomkeep/shared";
import { ActivityType, ReviewTargetType } from "@loomkeep/shared";
import { canonicalExternalId } from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
import { classifyStatusTransition } from "../social/activity-transition.util";
import { ActivityService } from "../social/activity.service";
import { AgeGateService } from "../users/age-gate.service";
import { filterAdultContent } from "../users/age.util";
import { BookItemService } from "./book-item.service";
import { AddBookReplayDto } from "./dto/add-book-replay.dto";
import { UpdateBookEntryDto } from "./dto/update-book-entry.dto";
import { UpsertBookEntryDto } from "./dto/upsert-book-entry.dto";

// Entries always need the book + its external IDs (canonical sourceId), plus
// its replay history, most recent first.
const ENTRY_INCLUDE = {
  bookItem: { include: { externalIds: true } },
  replays: { orderBy: { finishedAt: "desc" } },
} satisfies Prisma.BookEntryInclude;

type EntryWithBook = Prisma.BookEntryGetPayload<{
  include: typeof ENTRY_INCLUDE;
}>;

const PAGE_SIZE = 40;

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
const BOOK_SORT_KEYS: BookSortKey[] = [
  "added",
  "title",
  "author",
  "rating",
  "pages",
  "progress",
  "finished",
  "started",
  "status",
];
const BOOK_STATUS_SORT_ORDER = [
  "TO_READ",
  "READING",
  "READ",
  "DROPPED",
] as const;

export interface ListEntriesFilters {
  q?: string;
  favorite?: boolean;
  statuses?: string[];
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
}

function timeMs(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

function readPct(e: BookEntryDto): number {
  return e.book.pageCount ? e.currentPage / e.book.pageCount : 0;
}

// Base comparator per criterion (its natural order); `order: "asc"` negates it.
function compareBookEntries(
  sort: BookSortKey,
  a: BookEntryDto,
  b: BookEntryDto,
): number {
  switch (sort) {
    case "title":
      return a.book.title.localeCompare(b.book.title, "fr");
    case "author":
      return (a.book.authors[0] ?? "").localeCompare(
        b.book.authors[0] ?? "",
        "fr",
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
  ) {}

  /** Emits the status milestone + FAVORITED events for a book entry write. */
  private async emitEntryActivity(
    userId: string,
    bookItemId: string,
    change: {
      prevStatus: string | null;
      nextStatus: string;
      prevFavorite: boolean;
      nextFavorite: boolean;
    },
  ): Promise<void> {
    const transition = classifyStatusTransition(
      "BOOKS",
      change.prevStatus,
      change.nextStatus,
    );

    if (transition) {
      await this.activity.emit({
        userId,
        type: transition.type,
        domain: "BOOKS",
        targetType: ReviewTargetType.BOOK,
        targetId: bookItemId,
        homeFeed: transition.homeFeed,
      });
    }

    if (change.nextFavorite && !change.prevFavorite) {
      await this.activity.emit({
        userId,
        type: ActivityType.FAVORITED,
        domain: "BOOKS",
        targetType: ReviewTargetType.BOOK,
        targetId: bookItemId,
        homeFeed: false,
      });
    }
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
    };
    const entry = await this.prisma.bookEntry.upsert({
      where: { userId_bookItemId: { userId, bookItemId: bookItem.id } },
      update: changes,
      create: { userId, bookItemId: bookItem.id, ...changes },
      include: ENTRY_INCLUDE,
    });

    await this.emitEntryActivity(userId, bookItem.id, {
      prevStatus: before?.status ?? null,
      nextStatus: entry.status,
      prevFavorite: before?.favorite ?? false,
      nextFavorite: entry.favorite,
    });

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.BOOK,
        bookItem.id,
        dto.rating,
      );
    }

    return toEntryDto(
      entry,
      await this.reviews.getRating(userId, ReviewTargetType.BOOK, bookItem.id),
    );
  }

  async listEntries(
    userId: string,
    filters: ListEntriesFilters,
  ): Promise<PagedResult<BookEntryDto>> {
    const entries = await this.prisma.bookEntry.findMany({
      where: {
        userId,
        status:
          filters.statuses && filters.statuses.length > 0
            ? { in: filters.statuses as DbBookStatus[] }
            : undefined,
      },
      include: ENTRY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });

    const ratings = await this.reviews.getRatings(
      userId,
      ReviewTargetType.BOOK,
      entries.map((e) => e.bookItemId),
    );
    let dtos = entries.map((e) =>
      toEntryDto(e, ratings.get(e.bookItemId) ?? null),
    );

    const q = filters.q?.trim().toLowerCase();
    dtos = dtos.filter((dto) => {
      if (filters.favorite && !dto.favorite) return false;
      if (q && !dto.book.title.toLowerCase().includes(q)) return false;
      return true;
    });

    const sort = BOOK_SORT_KEYS.includes(filters.sort as BookSortKey)
      ? (filters.sort as BookSortKey)
      : "added";
    const asc = filters.order === "asc";
    dtos.sort((a, b) => {
      const c = compareBookEntries(sort, a, b);
      return asc ? -c : c;
    });

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const start = (page - 1) * PAGE_SIZE;
    return {
      items: dtos.slice(start, start + PAGE_SIZE),
      total: dtos.length,
      hasMore: dtos.length > page * PAGE_SIZE,
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
      select: { status: true, favorite: true },
    });

    const entry = await this.prisma.bookEntry.update({
      where: { id: entryId },
      data: {
        status: dto.status,
        notes: dto.notes,
        favorite: dto.favorite,
        currentPage: dto.currentPage,
        startedAt:
          dto.startedAt === undefined ? undefined : toDateOrNull(dto.startedAt),
        finishedAt:
          dto.finishedAt === undefined
            ? undefined
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

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.BOOK,
        entry.bookItemId,
        dto.rating,
      );
    }

    return toEntryDto(
      entry,
      await this.reviews.getRating(
        userId,
        ReviewTargetType.BOOK,
        entry.bookItemId,
      ),
    );
  }

  async deleteEntry(userId: string, entryId: string): Promise<void> {
    await this.assertEntryOwnership(userId, entryId);
    await this.prisma.bookEntry.delete({ where: { id: entryId } });
  }

  /** Log a completed reread (a completion beyond the entry's first one). */
  async addReplay(
    userId: string,
    entryId: string,
    dto: AddBookReplayDto,
  ): Promise<BookEntryDto> {
    await this.assertEntryOwnership(userId, entryId);

    await this.prisma.bookReplay.create({
      data: {
        bookEntryId: entryId,
        finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : undefined,
      },
    });

    const entry = await this.prisma.bookEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: ENTRY_INCLUDE,
    });

    await this.activity.emit({
      userId,
      type: ActivityType.REWATCHED,
      domain: "BOOKS",
      targetType: ReviewTargetType.BOOK,
      targetId: entry.bookItemId,
      homeFeed: true,
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

  async deleteReplay(userId: string, replayId: string): Promise<void> {
    const replay = await this.prisma.bookReplay.findUnique({
      where: { id: replayId },
      include: { bookEntry: true },
    });

    if (!replay) {
      throw new NotFoundException("Replay not found");
    }

    if (replay.bookEntry.userId !== userId) {
      throw new ForbiddenException("This replay belongs to another user");
    }

    await this.prisma.bookReplay.delete({ where: { id: replayId } });
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
  ): Promise<BookDetailDto> {
    const details = await this.bookItemService.getLiveDetails(source, sourceId);
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

  private async assertEntryOwnership(
    userId: string,
    entryId: string,
  ): Promise<BookEntry> {
    const entry = await this.prisma.bookEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new NotFoundException("Book library entry not found");
    }

    if (entry.userId !== userId) {
      throw new ForbiddenException("This entry belongs to another user");
    }

    return entry;
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
    startedAt: entry.startedAt?.toISOString() ?? null,
    finishedAt: entry.finishedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    replays: entry.replays.map(toReplayDto),
    ownershipStatus: entry.ownershipStatus,
    ownershipSource: entry.ownershipSource,
  };
}

function toReplayDto(replay: BookReplay): BookReplayDto {
  return { id: replay.id, finishedAt: replay.finishedAt.toISOString() };
}

function toDateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
