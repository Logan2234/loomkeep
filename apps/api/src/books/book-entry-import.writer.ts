import type { BookStatus } from "@loomkeep/shared/enums";
import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import {
  LOAN_INCLUDE,
  loanUpdate,
  ownershipSourceUpdate,
} from "../work/entry-loan.util";

/** What an import merges into: the entry's current values, or null. */
export type ImportedBookEntryState = Awaited<
  ReturnType<BookEntryImportWriter["findForMerge"]>
>;

/** How far along each status is: an import only ever moves an entry forward. */
const STATUS_RANK: Record<BookStatus, number> = {
  TO_READ: 0,
  READING: 1,
  DROPPED: 1,
  READ: 2,
};

type BookEntryData = Omit<
  Prisma.BookEntryUncheckedCreateInput,
  "userId" | "bookItemId"
>;

/**
 * Every write a book import makes to the books tables (BookEntry,
 * BookReading), kept here beside the books module that owns them. No side
 * effect runs: an import earns its XP once, at the end (ImportJobService).
 */
export class BookEntryImportWriter {
  constructor(private readonly prisma: PrismaService) {}

  findForMerge(userId: string, bookItemId: string) {
    return this.prisma.bookEntry.findUnique({
      where: { userId_bookItemId: { userId, bookItemId } },
      select: {
        id: true,
        status: true,
        notes: true,
        startedAt: true,
        finishedAt: true,
        ownershipStatus: true,
        ...LOAN_INCLUDE,
      },
    });
  }

  /** Drops the user's entry of one book, which the import replaces. Reading cycles cascade. */
  async removeTitle(userId: string, bookItemId: string): Promise<void> {
    await this.prisma.bookEntry.deleteMany({ where: { userId, bookItemId } });
  }

  /** Drops every entry of the user's but those of `kept` books. Reading cycles cascade. */
  async removeAllExcept(userId: string, kept: string[]): Promise<void> {
    await this.prisma.bookEntry.deleteMany({
      where: { userId, bookItemId: { notIn: kept } },
    });
  }

  /** Writes the row the source describes, merged into the entry if there is one. */
  write(
    userId: string,
    bookItemId: string,
    existing: ImportedBookEntryState,
    data: BookEntryData,
  ) {
    return this.prisma.bookEntry.upsert({
      where: { userId_bookItemId: { userId, bookItemId } },
      update: existing ? mergeInto(existing, data) : data,
      create: { userId, bookItemId, ...data },
    });
  }

  /** A first-time import's reading cycles, from the source's read count. */
  async backfillReadings(
    readings: Prisma.BookReadingCreateManyInput[],
  ): Promise<void> {
    await this.prisma.bookReading.createMany({ data: readings });
  }
}

/**
 * The same rule as media (MediaEntryImportWriter): an import adds what it
 * knows and never takes anything away. The status only moves forward, the
 * reading progress is replaced only by a book now finished, and a note or
 * date the entry already has stays (the user may have corrected it here).
 */
function mergeInto(
  existing: NonNullable<ImportedBookEntryState>,
  data: BookEntryData,
): Prisma.BookEntryUncheckedUpdateInput {
  const incoming = data.status as BookStatus;
  const status =
    STATUS_RANK[incoming] > STATUS_RANK[existing.status]
      ? incoming
      : existing.status;
  const finished = status === "READ" && existing.status !== "READ";
  // Most sources only know "owned" or nothing: their NONE says nothing about
  // a copy the user recorded here.
  const ownership =
    data.ownershipStatus && data.ownershipStatus !== "NONE"
      ? { ownershipStatus: data.ownershipStatus }
      : null;

  return {
    status,
    notes: existing.notes ? undefined : (data.notes ?? undefined),
    startedAt: existing.startedAt ? undefined : (data.startedAt ?? undefined),
    finishedAt: existing.finishedAt
      ? undefined
      : (data.finishedAt ?? undefined),
    ...(finished && {
      currentPage: data.currentPage,
      readingBaselinePage: data.readingBaselinePage,
      editionKey: data.editionKey,
      referencePageCount: data.referencePageCount,
    }),
    // A new ownership status drops the source and loan it no longer fits.
    ...(ownership && {
      ...ownership,
      ownershipSource: ownershipSourceUpdate(
        existing.ownershipStatus,
        ownership,
      ),
      ...loanUpdate(existing, ownership),
    }),
  };
}
