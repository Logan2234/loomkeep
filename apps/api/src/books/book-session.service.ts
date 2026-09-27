import type {
  BookSessionDto,
  BookSessionMutationDto,
  BookSessionSummaryDto,
} from "@loomkeep/shared";
import {
  ActivityType,
  Domain,
  ErrorCode,
  ReviewTargetType,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { BookSession, Prisma } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { localDay } from "../common/local-day.util";
import { bookSessionAggregate } from "../common/session-aggregate.util";
import { sessionPeriodMinutes } from "../common/session-period.util";
import { SessionXpService } from "../gamification/session-xp.service";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityService } from "../social/activity.service";
import { CreateBookSessionDto } from "./dto/create-book-session.dto";
import { UpdateBookSessionDto } from "./dto/update-book-session.dto";

const PAGE_SIZE = 10;
const PACE_WINDOW_DAYS = 30;

@Injectable()
export class BookSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly sessionXp: SessionXpService,
  ) {}

  async list(
    userId: string,
    entryId: string,
    page = 1,
  ): Promise<BookSessionSummaryDto> {
    await this.ownedEntry(userId, entryId);
    return this.summary(entryId, Math.max(1, page));
  }

  async create(
    userId: string,
    entryId: string,
    dto: CreateBookSessionDto,
  ): Promise<BookSessionMutationDto> {
    const occurredAt = this.validDate(dto.occurredAt);
    const entry = await this.ownedEntry(userId, entryId);
    this.assertEdition(entry);
    const pages = this.normalizePages(dto);

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.bookSession.create({
        data: {
          bookEntryId: entry.id,
          durationMinutes: dto.durationMinutes,
          occurredAt,
          ...pages,
        },
      });
      await this.recomputeEntry(tx, entry.id);
      await tx.bookEntry.update({
        where: { id: entry.id },
        data: {
          ...(entry.status === "TO_READ" ? { status: "READING" } : {}),
          ...(entry.startedAt === null ? { startedAt: occurredAt } : {}),
        },
      });
      return created;
    });

    await this.activity.emit({
      userId,
      type: ActivityType.PROGRESS,
      domain: Domain.BOOKS,
      targetType: ReviewTargetType.BOOK,
      targetId: entry.bookItemId,
      homeFeed: true,
      sourceType: "BookSession",
      sourceId: session.id,
      data: this.activityData(session),
    });
    const xpAwarded = await this.sessionXp.awardForToday(userId);

    return {
      session: toDto(session),
      summary: await this.summary(entry.id, 1),
      xpAwarded,
    };
  }

  async update(
    userId: string,
    sessionId: string,
    dto: UpdateBookSessionDto,
  ): Promise<BookSessionMutationDto> {
    const before = await this.ownedSession(userId, sessionId);
    const occurredAt = dto.occurredAt
      ? this.validDate(dto.occurredAt)
      : before.occurredAt;
    const pages = this.normalizeUpdatePages(before, dto);
    const session = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.bookSession.update({
        where: { id: sessionId },
        data: {
          durationMinutes: dto.durationMinutes ?? before.durationMinutes,
          occurredAt,
          ...pages,
        },
      });
      await this.recomputeEntry(tx, before.bookEntryId);
      return updated;
    });

    await this.activity.updateLinked(
      "BookSession",
      session.id,
      this.activityData(session),
    );
    return {
      session: toDto(session),
      summary: await this.summary(before.bookEntryId, 1),
      xpAwarded: false,
    };
  }

  async delete(userId: string, sessionId: string): Promise<void> {
    const session = await this.ownedSession(userId, sessionId);
    await this.prisma.$transaction(async (tx) => {
      await tx.bookSession.delete({ where: { id: sessionId } });
      await this.recomputeEntry(tx, session.bookEntryId);
    });
    await this.activity.deleteLinked("BookSession", sessionId);
    await this.sessionXp.refreshAfterDelete(userId, session.createdAt);
  }

  private async recomputeEntry(
    tx: Prisma.TransactionClient,
    entryId: string,
  ): Promise<void> {
    const [entry, sessions] = await Promise.all([
      tx.bookEntry.findUniqueOrThrow({
        where: { id: entryId },
        select: { readingBaselinePage: true, referencePageCount: true },
      }),
      tx.bookSession.findMany({
        where: { bookEntryId: entryId },
        orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
        select: {
          durationMinutes: true,
          pagesRead: true,
          startPage: true,
          endPage: true,
        },
      }),
    ]);
    const aggregate = bookSessionAggregate(
      entry.readingBaselinePage,
      entry.referencePageCount,
      sessions,
    );
    await tx.bookEntry.update({
      where: { id: entryId },
      data: {
        currentPage: aggregate.currentPage,
        trackedReadingMinutes: aggregate.trackedMinutes,
      },
    });
  }

  private async summary(
    entryId: string,
    page: number,
  ): Promise<BookSessionSummaryDto> {
    const now = new Date();
    const paceSince = new Date(now);
    paceSince.setUTCDate(paceSince.getUTCDate() - PACE_WINDOW_DAYS);
    const [rows, recent, totals, entry] = await Promise.all([
      this.prisma.bookSession.findMany({
        where: { bookEntryId: entryId },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE + 1,
      }),
      this.prisma.bookSession.findMany({
        where: { bookEntryId: entryId, occurredAt: { gte: paceSince } },
        select: { occurredAt: true, durationMinutes: true, pagesRead: true },
      }),
      this.prisma.bookSession.aggregate({
        where: { bookEntryId: entryId },
        _count: true,
        _sum: { pagesRead: true },
      }),
      this.prisma.bookEntry.findUniqueOrThrow({
        where: { id: entryId },
        select: {
          currentPage: true,
          referencePageCount: true,
          trackedReadingMinutes: true,
          status: true,
          user: { select: { timezone: true } },
        },
      }),
    ]);
    const timezone = entry.user.timezone ?? "UTC";
    const periods = sessionPeriodMinutes(recent, timezone, now);
    const days = new Set(
      recent.map(
        (session) =>
          localDay(timezone, session.occurredAt) ??
          session.occurredAt.toISOString().slice(0, 10),
      ),
    );
    const recentPages = recent.reduce(
      (total, session) => total + session.pagesRead,
      0,
    );
    const averagePagesPerDay =
      days.size >= 3 ? Math.round((recentPages / days.size) * 10) / 10 : null;
    const remaining =
      entry.referencePageCount === null
        ? null
        : Math.max(0, entry.referencePageCount - entry.currentPage);
    const estimatedCompletionDate =
      averagePagesPerDay && remaining && remaining > 0
        ? new Date(
            now.getTime() +
              Math.ceil(remaining / averagePagesPerDay) * 24 * 60 * 60 * 1000,
          )
            .toISOString()
            .slice(0, 10)
        : null;

    return {
      items: rows.slice(0, PAGE_SIZE).map(toDto),
      hasMore: rows.length > PAGE_SIZE,
      totalSessions: totals._count,
      totalTrackedMinutes: entry.trackedReadingMinutes,
      totalPagesRead: totals._sum.pagesRead ?? 0,
      ...periods,
      averagePagesPerDay,
      estimatedCompletionDate,
      completionSuggested:
        entry.referencePageCount !== null &&
        entry.currentPage >= entry.referencePageCount &&
        entry.status !== "READ",
    };
  }

  private normalizePages(dto: {
    pagesRead?: number;
    startPage?: number | null;
    endPage?: number | null;
  }): { pagesRead: number; startPage: number | null; endPage: number | null } {
    const quantity = dto.pagesRead !== undefined;
    const range =
      (dto.startPage !== null && dto.startPage !== undefined) ||
      (dto.endPage !== null && dto.endPage !== undefined);
    if (quantity === range) this.invalidPages();

    if (quantity) {
      return { pagesRead: dto.pagesRead!, startPage: null, endPage: null };
    }

    if (
      dto.startPage === null ||
      dto.startPage === undefined ||
      dto.endPage === null ||
      dto.endPage === undefined ||
      dto.endPage <= dto.startPage
    ) {
      this.invalidPages();
    }

    return {
      pagesRead: dto.endPage - dto.startPage,
      startPage: dto.startPage,
      endPage: dto.endPage,
    };
  }

  private normalizeUpdatePages(before: BookSession, dto: UpdateBookSessionDto) {
    if (dto.pagesRead !== undefined) {
      return this.normalizePages({ pagesRead: dto.pagesRead });
    }

    if (dto.startPage !== undefined || dto.endPage !== undefined) {
      return this.normalizePages({
        startPage: dto.startPage,
        endPage: dto.endPage,
      });
    }

    return {
      pagesRead: before.pagesRead,
      startPage: before.startPage,
      endPage: before.endPage,
    };
  }

  private async ownedEntry(userId: string, entryId: string) {
    const entry = await this.prisma.bookEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        userId: true,
        bookItemId: true,
        status: true,
        startedAt: true,
        editionKey: true,
        referencePageCount: true,
      },
    });

    if (!entry) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibraryEntryNotFound,
      );
    }

    if (entry.userId !== userId) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.LibraryEntryForbidden,
      );
    }

    return entry;
  }

  private async ownedSession(userId: string, sessionId: string) {
    const session = await this.prisma.bookSession.findUnique({
      where: { id: sessionId },
      include: { bookEntry: { select: { userId: true } } },
    });

    if (!session) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibrarySessionNotFound,
      );
    }

    if (session.bookEntry.userId !== userId) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.LibrarySessionForbidden,
      );
    }

    return session;
  }

  private assertEdition(entry: {
    editionKey: string | null;
    referencePageCount: number | null;
  }): void {
    if (!entry.editionKey || !entry.referencePageCount) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.LibraryBookEditionRequired,
      );
    }
  }

  private validDate(value: string): Date {
    const date = new Date(value);

    if (date.getTime() > Date.now()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.LibrarySessionDateFuture,
      );
    }

    return date;
  }

  private invalidPages(): never {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.LibrarySessionInvalidPages,
    );
  }

  private activityData(
    session: Pick<
      BookSession,
      "durationMinutes" | "pagesRead" | "startPage" | "endPage" | "occurredAt"
    >,
  ) {
    return {
      durationMinutes: session.durationMinutes,
      pagesRead: session.pagesRead,
      startPage: session.startPage,
      endPage: session.endPage,
      occurredAt: session.occurredAt.toISOString(),
    };
  }
}

function toDto(session: BookSession): BookSessionDto {
  return {
    id: session.id,
    durationMinutes: session.durationMinutes,
    pagesRead: session.pagesRead,
    startPage: session.startPage,
    endPage: session.endPage,
    occurredAt: session.occurredAt.toISOString(),
    source: session.source,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
