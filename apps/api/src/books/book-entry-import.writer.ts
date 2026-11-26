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
      select: { id: true, ownershipStatus: true, ...LOAN_INCLUDE },
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

  /** Writes the row the source describes over the entry, keeping its loan coherent. */
  write(
    userId: string,
    bookItemId: string,
    existing: ImportedBookEntryState,
    data: Omit<Prisma.BookEntryUncheckedCreateInput, "userId" | "bookItemId">,
  ) {
    const ownership = { ownershipStatus: data.ownershipStatus };
    return this.prisma.bookEntry.upsert({
      where: { userId_bookItemId: { userId, bookItemId } },
      // A new ownership status drops the source and loan it no longer fits.
      update: existing
        ? {
            ...data,
            ownershipSource: ownershipSourceUpdate(
              existing.ownershipStatus,
              ownership,
            ),
            ...loanUpdate(existing, ownership),
          }
        : data,
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
