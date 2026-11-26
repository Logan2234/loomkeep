import type { BookReadingDto } from "@loomkeep/shared";
import type { Prisma } from "@prisma/client";

export function toReadingDto(
  reading: Prisma.BookReadingGetPayload<{
    select: {
      id: true;
      number: true;
      status: true;
      editionKey: true;
      referencePageCount: true;
      currentPage: true;
      startedAt: true;
      finishedAt: true;
      trackedMinutes: true;
      pagesRead: true;
      legacyIncomplete: true;
      _count: { select: { sessions: true } };
    };
  }>,
): BookReadingDto {
  return {
    id: reading.id,
    number: reading.number,
    status: reading.status,
    editionKey: reading.editionKey,
    referencePageCount: reading.referencePageCount,
    currentPage: reading.currentPage,
    startedAt: reading.startedAt?.toISOString() ?? null,
    finishedAt: reading.finishedAt?.toISOString() ?? null,
    sessionCount: reading._count.sessions,
    trackedMinutes: reading.trackedMinutes,
    pagesRead: reading.pagesRead,
    legacyIncomplete: reading.legacyIncomplete,
  };
}
