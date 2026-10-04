import type {
  BookSessionDto,
  BookSessionMutationDto,
  BookSessionSummaryDto,
} from "@loomkeep/shared";
import {
  ActivityType,
  BookStatus,
  Domain,
  ErrorCode,
  ReviewTargetType,
  SessionCycleAction,
  TrackingCycleStatus,
  XpReason,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import {
  SessionSource,
  type BookReading,
  type BookSession,
  type Prisma,
} from "@prisma/client";
import { AppException } from "../common/app.exception";
import { addDays, utcDateKey } from "../common/date.util";
import { localDayOrUtc } from "../common/local-day.util";
import { toPagedResult } from "../common/pagination.util";
import { bookSessionAggregate } from "../common/session-aggregate.util";
import { sessionPeriodMinutes } from "../common/session-period.util";
import { normalizeSessionNotes, sessionDate } from "../common/session.util";
import { AchievementService } from "../gamification/achievements/achievement.service";
import { ACHIEVEMENT_KEYS_BY_XP_REASON } from "../gamification/achievements/registry";
import { SessionXpService } from "../gamification/session-xp.service";
import { XpService } from "../gamification/xp.service";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityService } from "../social/activity.service";
import { toReadingDto } from "./book.mappers";
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
    private readonly xp: XpService,
    private readonly achievements: AchievementService,
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
    source: SessionSource = SessionSource.MANUAL,
  ): Promise<BookSessionMutationDto> {
    const occurredAt = sessionDate(dto.occurredAt);
    const entry = await this.ownedEntry(userId, entryId);
    this.assertEdition(entry);
    const pages = this.normalizePages(dto, entry.referencePageCount);

    const { session, reading, completed } = await this.prisma.$transaction(
      async (tx) => {
        const reading = await this.resolveReading(
          tx,
          entry,
          occurredAt,
          dto.cycleAction,
        );
        const created = await tx.bookSession.create({
          data: {
            bookEntryId: entry.id,
            readingId: reading?.id ?? null,
            durationMinutes: dto.durationMinutes,
            notes: normalizeSessionNotes(dto.notes),
            occurredAt,
            source,
            ...pages,
          },
        });
        await tx.bookEntry.update({
          where: { id: entry.id },
          data: {
            trackedReadingMinutes: { increment: dto.durationMinutes },
          },
        });

        if (!reading) {
          return { session: created, reading: null, completed: false };
        }

        await tx.bookReading.update({
          where: { id: reading.id },
          data: {
            trackedMinutes: { increment: dto.durationMinutes },
            pagesRead: { increment: pages.pagesRead },
          },
        });
        const recomputed = await this.recomputeReading(
          tx,
          reading.id,
          entry.id,
          occurredAt,
        );
        return {
          session: created,
          reading,
          completed: recomputed.completed,
        };
      },
    );

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
    await this.awardCompletion(userId, reading, completed);
    const xpAwarded = await this.sessionXp.awardForToday(userId);

    return {
      session: toDto(session, reading?.number ?? null),
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
      ? sessionDate(dto.occurredAt)
      : before.occurredAt;
    const pages = this.normalizeUpdatePages(
      before,
      dto,
      before.reading?.referencePageCount ?? before.bookEntry.referencePageCount,
    );
    const durationMinutes = dto.durationMinutes ?? before.durationMinutes;
    const durationDelta = durationMinutes - before.durationMinutes;
    const pagesDelta = pages.pagesRead - before.pagesRead;
    const { session, completed } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.bookSession.update({
          where: { id: sessionId },
          data: {
            durationMinutes,
            notes:
              dto.notes === undefined
                ? before.notes
                : normalizeSessionNotes(dto.notes),
            occurredAt,
            ...pages,
          },
        });

        if (durationDelta !== 0) {
          await tx.bookEntry.update({
            where: { id: before.bookEntryId },
            data: {
              trackedReadingMinutes: { increment: durationDelta },
            },
          });
        }

        if (before.readingId) {
          await tx.bookReading.update({
            where: { id: before.readingId },
            data: {
              ...(durationDelta !== 0
                ? { trackedMinutes: { increment: durationDelta } }
                : {}),
              ...(pagesDelta !== 0
                ? { pagesRead: { increment: pagesDelta } }
                : {}),
            },
          });

          if (before.reading?.status === TrackingCycleStatus.ACTIVE) {
            const recomputed = await this.recomputeReading(
              tx,
              before.readingId,
              before.bookEntryId,
              occurredAt,
            );
            return { session: updated, completed: recomputed.completed };
          }
        }

        return { session: updated, completed: false };
      },
    );

    await this.activity.updateLinked(
      "BookSession",
      session.id,
      this.activityData(session),
    );
    await this.awardCompletion(userId, before.reading, completed);
    return {
      session: toDto(session, before.reading?.number ?? null),
      summary: await this.summary(before.bookEntryId, 1),
      xpAwarded: false,
    };
  }

  async delete(userId: string, sessionId: string): Promise<void> {
    const session = await this.ownedSession(userId, sessionId);
    await this.prisma.$transaction(async (tx) => {
      await tx.bookSession.delete({ where: { id: sessionId } });
      await tx.bookEntry.update({
        where: { id: session.bookEntryId },
        data: {
          trackedReadingMinutes: { decrement: session.durationMinutes },
        },
      });
      if (!session.readingId) return;

      const remaining = await tx.bookSession.count({
        where: { readingId: session.readingId },
      });

      if (
        remaining === 0 &&
        session.reading?.status === TrackingCycleStatus.ACTIVE
      ) {
        await tx.bookReading.delete({ where: { id: session.readingId } });
        const previous = await tx.bookReading.findFirst({
          where: { bookEntryId: session.bookEntryId },
          orderBy: { number: "desc" },
        });
        await tx.bookEntry.update({
          where: { id: session.bookEntryId },
          data: previous
            ? {
                status:
                  previous.status === TrackingCycleStatus.COMPLETED
                    ? BookStatus.READ
                    : previous.status === TrackingCycleStatus.DROPPED
                      ? BookStatus.DROPPED
                      : BookStatus.READING,
                currentPage: previous.currentPage,
                editionKey: previous.editionKey,
                referencePageCount: previous.referencePageCount,
                readingBaselinePage: previous.baselinePage,
              }
            : {
                status: BookStatus.TO_READ,
                currentPage: 0,
                readingBaselinePage: 0,
                startedAt: null,
              },
        });
        return;
      }

      await tx.bookReading.update({
        where: { id: session.readingId },
        data: {
          trackedMinutes: { decrement: session.durationMinutes },
          pagesRead: { decrement: session.pagesRead },
        },
      });

      if (session.reading?.status === TrackingCycleStatus.ACTIVE) {
        await this.recomputeReading(tx, session.readingId, session.bookEntryId);
      }
    });
    await this.activity.deleteLinked("BookSession", sessionId);
    await this.sessionXp.refreshAfterDelete(userId, session.createdAt);
  }

  private async recomputeReading(
    tx: Prisma.TransactionClient,
    readingId: string,
    entryId: string,
    completionAt?: Date,
  ): Promise<{ completed: boolean }> {
    const [reading, entry, sessions] = await Promise.all([
      tx.bookReading.findUniqueOrThrow({
        where: { id: readingId },
        select: {
          baselinePage: true,
          referencePageCount: true,
          status: true,
          startedAt: true,
          finishedAt: true,
        },
      }),
      tx.bookEntry.findUniqueOrThrow({
        where: { id: entryId },
        select: { startedAt: true, finishedAt: true },
      }),
      tx.bookSession.findMany({
        where: { readingId },
        orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
        select: {
          durationMinutes: true,
          pagesRead: true,
          startPage: true,
          endPage: true,
          occurredAt: true,
        },
      }),
    ]);
    const aggregate = bookSessionAggregate(
      reading.baselinePage,
      reading.referencePageCount,
      sessions,
    );
    const completed =
      completionAt !== undefined &&
      reading.status === TrackingCycleStatus.ACTIVE &&
      aggregate.completionSuggested;

    await tx.bookReading.update({
      where: { id: readingId },
      data: {
        currentPage: aggregate.currentPage,
        ...(completed
          ? {
              status: TrackingCycleStatus.COMPLETED,
              finishedAt: completionAt,
            }
          : {}),
      },
    });

    await tx.bookEntry.update({
      where: { id: entryId },
      data: {
        currentPage: aggregate.currentPage,
        readingBaselinePage: reading.baselinePage,
        referencePageCount: reading.referencePageCount,
        status: completed ? BookStatus.READ : BookStatus.READING,
        ...(entry.startedAt === null && sessions[0]
          ? { startedAt: sessions[0].occurredAt }
          : {}),
        ...(completed && entry.finishedAt === null
          ? { finishedAt: completionAt }
          : {}),
      },
    });

    return { completed };
  }

  private async awardCompletion(
    userId: string,
    reading: Pick<BookReading, "id" | "number"> | null | undefined,
    completed: boolean,
  ): Promise<void> {
    if (!completed || !reading) return;

    const reason =
      reading.number === 1 ? XpReason.BOOK_FINISHED : XpReason.BOOK_REPLAYED;
    await this.xp.award(userId, reason, reading.id);
    await this.achievements.evaluate(
      userId,
      ACHIEVEMENT_KEYS_BY_XP_REASON[reason],
    );
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
        include: { reading: { select: { number: true } } },
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
          readings: {
            where: { status: TrackingCycleStatus.ACTIVE },
            take: 1,
            select: {
              id: true,
              number: true,
              status: true,
              editionKey: true,
              referencePageCount: true,
              currentPage: true,
              startedAt: true,
              finishedAt: true,
              trackedMinutes: true,
              pagesRead: true,
              legacyIncomplete: true,
              _count: { select: { sessions: true } },
            },
          },
          user: { select: { timezone: true } },
        },
      }),
    ]);
    const timezone = entry.user.timezone ?? "UTC";
    const periods = sessionPeriodMinutes(recent, timezone, now);
    const days = new Set(
      recent.map((session) => localDayOrUtc(timezone, session.occurredAt)),
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
        ? utcDateKey(addDays(now, Math.ceil(remaining / averagePagesPerDay)))
        : null;

    const { items, hasMore } = toPagedResult(rows, PAGE_SIZE);
    return {
      items: items.map((session) =>
        toDto(session, session.reading?.number ?? null),
      ),
      hasMore,
      totalSessions: totals._count,
      totalTrackedMinutes: entry.trackedReadingMinutes,
      totalPagesRead: totals._sum.pagesRead ?? 0,
      activeReading: entry.readings[0] ? toReadingDto(entry.readings[0]) : null,
      ...periods,
      averagePagesPerDay,
      estimatedCompletionDate,
      completionSuggested:
        entry.referencePageCount !== null &&
        entry.currentPage >= entry.referencePageCount &&
        entry.status !== "READ",
    };
  }

  private normalizePages(
    dto: {
      pagesRead?: number;
      startPage?: number | null;
      endPage?: number | null;
    },
    referencePageCount: number | null,
  ): {
    pagesRead: number;
    startPage: number | null;
    endPage: number | null;
  } {
    if (!referencePageCount) this.invalidPages();
    const quantity = dto.pagesRead !== undefined;
    const range =
      (dto.startPage !== null && dto.startPage !== undefined) ||
      (dto.endPage !== null && dto.endPage !== undefined);
    if (quantity === range) this.invalidPages();

    if (quantity) {
      if (dto.pagesRead! > referencePageCount) this.invalidPages();
      return { pagesRead: dto.pagesRead!, startPage: null, endPage: null };
    }

    if (
      dto.startPage === null ||
      dto.startPage === undefined ||
      dto.endPage === null ||
      dto.endPage === undefined ||
      dto.endPage <= dto.startPage ||
      dto.endPage > referencePageCount
    ) {
      this.invalidPages();
    }

    return {
      pagesRead: dto.endPage - dto.startPage,
      startPage: dto.startPage,
      endPage: dto.endPage,
    };
  }

  private normalizeUpdatePages(
    before: BookSession,
    dto: UpdateBookSessionDto,
    referencePageCount: number | null,
  ) {
    if (dto.pagesRead !== undefined) {
      return this.normalizePages(
        { pagesRead: dto.pagesRead },
        referencePageCount,
      );
    }

    if (dto.startPage !== undefined || dto.endPage !== undefined) {
      return this.normalizePages(
        {
          startPage: dto.startPage,
          endPage: dto.endPage,
        },
        referencePageCount,
      );
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
        readingBaselinePage: true,
        currentPage: true,
        finishedAt: true,
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
      include: {
        bookEntry: { select: { userId: true, referencePageCount: true } },
        reading: {
          select: {
            id: true,
            number: true,
            status: true,
            editionKey: true,
            referencePageCount: true,
            baselinePage: true,
            currentPage: true,
          },
        },
      },
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

  private async resolveReading(
    tx: Prisma.TransactionClient,
    entry: Awaited<ReturnType<BookSessionService["ownedEntry"]>>,
    occurredAt: Date,
    action?: (typeof SessionCycleAction)[keyof typeof SessionCycleAction],
  ): Promise<BookReading | null> {
    if (action === SessionCycleAction.HISTORY_ONLY) return null;

    const active = await tx.bookReading.findFirst({
      where: { bookEntryId: entry.id, status: TrackingCycleStatus.ACTIVE },
      orderBy: { number: "desc" },
    });
    if (active) return active;

    if (
      entry.status === BookStatus.DROPPED &&
      action === SessionCycleAction.CONTINUE
    ) {
      const dropped = await tx.bookReading.findFirst({
        where: {
          bookEntryId: entry.id,
          status: TrackingCycleStatus.DROPPED,
        },
        orderBy: { number: "desc" },
      });

      if (dropped) {
        return tx.bookReading.update({
          where: { id: dropped.id },
          data: { status: TrackingCycleStatus.ACTIVE, finishedAt: null },
        });
      }
    }

    const mayStart =
      entry.status === BookStatus.TO_READ ||
      entry.status === BookStatus.READING ||
      action === SessionCycleAction.RESTART;
    if (!mayStart) return null;

    const last = await tx.bookReading.aggregate({
      where: { bookEntryId: entry.id },
      _max: { number: true },
    });
    const restarting = action === SessionCycleAction.RESTART;
    return tx.bookReading.create({
      data: {
        bookEntryId: entry.id,
        number: (last._max.number ?? 0) + 1,
        status: TrackingCycleStatus.ACTIVE,
        editionKey: entry.editionKey,
        referencePageCount: entry.referencePageCount,
        baselinePage: restarting ? 0 : entry.readingBaselinePage,
        currentPage: restarting ? 0 : entry.currentPage,
        startedAt: occurredAt,
      },
    });
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

function toDto(
  session: BookSession,
  readingNumber: number | null = null,
): BookSessionDto {
  return {
    id: session.id,
    readingId: session.readingId,
    readingNumber,
    durationMinutes: session.durationMinutes,
    pagesRead: session.pagesRead,
    startPage: session.startPage,
    endPage: session.endPage,
    notes: session.notes,
    occurredAt: session.occurredAt.toISOString(),
    source: session.source,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
