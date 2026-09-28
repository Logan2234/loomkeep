import type {
  GameSessionDto,
  GameSessionMutationDto,
  GameSessionSummaryDto,
} from "@loomkeep/shared";
import {
  ActivityType,
  Domain,
  ErrorCode,
  ReviewTargetType,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { SessionSource, type GameSession } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { sessionPeriodMinutes } from "../common/session-period.util";
import { SessionXpService } from "../gamification/session-xp.service";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityService } from "../social/activity.service";
import { CreateGameSessionDto } from "./dto/create-game-session.dto";
import { UpdateGameSessionDto } from "./dto/update-game-session.dto";

const PAGE_SIZE = 10;

@Injectable()
export class GameSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly sessionXp: SessionXpService,
  ) {}

  async list(
    userId: string,
    entryId: string,
    page = 1,
  ): Promise<GameSessionSummaryDto> {
    const entry = await this.ownedEntry(userId, entryId);
    return this.summary(entry, Math.max(1, page));
  }

  async create(
    userId: string,
    entryId: string,
    dto: CreateGameSessionDto,
    source: SessionSource = SessionSource.MANUAL,
  ): Promise<GameSessionMutationDto> {
    const occurredAt = this.validDate(dto.occurredAt);
    const entry = await this.ownedEntry(userId, entryId);
    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.gameSession.create({
        data: {
          gameEntryId: entry.id,
          durationMinutes: dto.durationMinutes,
          notes: normalizeSessionNotes(dto.notes),
          occurredAt,
          source,
        },
      });
      await tx.gameEntry.update({
        where: { id: entry.id },
        data: {
          trackedPlaytimeMinutes: { increment: dto.durationMinutes },
          ...(entry.steamPlaytimeMinutes === null
            ? { playtimeMinutes: { increment: dto.durationMinutes } }
            : {}),
          ...(entry.status === "BACKLOG" ||
          (entry.status === "DROPPED" && dto.resumeTracking)
            ? { status: "PLAYING" }
            : {}),
          ...(entry.startedAt === null ? { startedAt: occurredAt } : {}),
        },
      });
      return created;
    });

    await this.activity.emit({
      userId,
      type: ActivityType.PROGRESS,
      domain: Domain.GAMES,
      targetType: ReviewTargetType.GAME,
      targetId: entry.gameItemId,
      homeFeed: true,
      sourceType: "GameSession",
      sourceId: session.id,
      data: this.activityData(session),
    });
    const xpAwarded = await this.sessionXp.awardForToday(userId);

    return {
      session: toDto(session),
      summary: await this.summary(
        {
          ...entry,
          trackedPlaytimeMinutes:
            entry.trackedPlaytimeMinutes + dto.durationMinutes,
        },
        1,
      ),
      xpAwarded,
    };
  }

  async update(
    userId: string,
    sessionId: string,
    dto: UpdateGameSessionDto,
  ): Promise<GameSessionMutationDto> {
    const before = await this.ownedSession(userId, sessionId);
    const occurredAt = dto.occurredAt
      ? this.validDate(dto.occurredAt)
      : before.occurredAt;
    const durationMinutes = dto.durationMinutes ?? before.durationMinutes;
    const notes =
      dto.notes === undefined ? before.notes : normalizeSessionNotes(dto.notes);
    const delta = durationMinutes - before.durationMinutes;
    const session = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.gameSession.update({
        where: { id: sessionId },
        data: { durationMinutes, notes, occurredAt },
      });

      if (delta !== 0) {
        await tx.gameEntry.update({
          where: { id: before.gameEntryId },
          data: {
            trackedPlaytimeMinutes: { increment: delta },
            ...(before.gameEntry.steamPlaytimeMinutes === null
              ? { playtimeMinutes: { increment: delta } }
              : {}),
          },
        });
      }

      return updated;
    });

    await this.activity.updateLinked(
      "GameSession",
      session.id,
      this.activityData(session),
    );
    const entry = await this.ownedEntry(userId, before.gameEntryId);
    return {
      session: toDto(session),
      summary: await this.summary(entry, 1),
      xpAwarded: false,
    };
  }

  async delete(userId: string, sessionId: string): Promise<void> {
    const session = await this.ownedSession(userId, sessionId);
    await this.prisma.$transaction(async (tx) => {
      await tx.gameSession.delete({ where: { id: sessionId } });
      const remainingSessions = await tx.gameSession.count({
        where: { gameEntryId: session.gameEntryId },
      });
      const resetToBacklog =
        remainingSessions === 0 &&
        session.gameEntry.status === "PLAYING" &&
        (session.gameEntry.steamPlaytimeMinutes ?? 0) === 0;
      await tx.gameEntry.update({
        where: { id: session.gameEntryId },
        data: {
          trackedPlaytimeMinutes: { decrement: session.durationMinutes },
          ...(session.gameEntry.steamPlaytimeMinutes === null
            ? { playtimeMinutes: { decrement: session.durationMinutes } }
            : {}),
          ...(resetToBacklog ? { status: "BACKLOG", startedAt: null } : {}),
        },
      });
    });
    await this.activity.deleteLinked("GameSession", sessionId);
    await this.sessionXp.refreshAfterDelete(userId, session.createdAt);
  }

  private async summary(
    entry: { id: string; trackedPlaytimeMinutes: number },
    page: number,
  ): Promise<GameSessionSummaryDto> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 40);
    const [rows, user, totalSessions, recent] = await Promise.all([
      this.prisma.gameSession.findMany({
        where: { gameEntryId: entry.id },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE + 1,
      }),
      this.prisma.gameEntry.findUniqueOrThrow({
        where: { id: entry.id },
        select: { user: { select: { timezone: true } } },
      }),
      this.prisma.gameSession.count({
        where: { gameEntryId: entry.id },
      }),
      this.prisma.gameSession.findMany({
        where: { gameEntryId: entry.id, occurredAt: { gte: since } },
        select: { occurredAt: true, durationMinutes: true },
      }),
    ]);
    const periods = sessionPeriodMinutes(recent, user.user.timezone ?? "UTC");
    return {
      items: rows.slice(0, PAGE_SIZE).map(toDto),
      hasMore: rows.length > PAGE_SIZE,
      totalSessions,
      totalTrackedMinutes: entry.trackedPlaytimeMinutes,
      ...periods,
    };
  }

  private async ownedEntry(userId: string, entryId: string) {
    const entry = await this.prisma.gameEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        userId: true,
        gameItemId: true,
        status: true,
        startedAt: true,
        playtimeMinutes: true,
        trackedPlaytimeMinutes: true,
        steamPlaytimeMinutes: true,
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
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        gameEntry: {
          select: {
            userId: true,
            status: true,
            steamPlaytimeMinutes: true,
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

    if (session.gameEntry.userId !== userId) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.LibrarySessionForbidden,
      );
    }

    return session;
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

  private activityData(
    session: Pick<GameSession, "durationMinutes" | "occurredAt">,
  ) {
    return {
      durationMinutes: session.durationMinutes,
      occurredAt: session.occurredAt.toISOString(),
    };
  }
}

function toDto(session: GameSession): GameSessionDto {
  return {
    id: session.id,
    durationMinutes: session.durationMinutes,
    notes: session.notes,
    occurredAt: session.occurredAt.toISOString(),
    source: session.source,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

function normalizeSessionNotes(
  notes: string | null | undefined,
): string | null {
  const trimmed = notes?.trim();
  return trimmed ? trimmed : null;
}
