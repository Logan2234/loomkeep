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
  SessionCycleAction,
  TrackingCycleStatus,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import {
  SessionSource,
  type GamePlaythrough,
  type GameSession,
  type Prisma,
} from "@prisma/client";
import { AppException } from "../common/app.exception";
import { toPagedResult } from "../common/pagination.util";
import { sessionPeriodMinutes } from "../common/session-period.util";
import { normalizeSessionNotes, sessionDate } from "../common/session.util";
import { SessionXpService } from "../gamification/session-xp.service";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityService } from "../social/activity.service";
import { CreateGameSessionDto } from "./dto/create-game-session.dto";
import { UpdateGameSessionDto } from "./dto/update-game-session.dto";
import { assertGameReleased } from "./game-release.util";
import { toPlaythroughDto } from "./game.mappers";

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
    const occurredAt = sessionDate(dto.occurredAt);
    const entry = await this.ownedEntry(userId, entryId);

    // An import reports play that happened, whatever IGDB says of the release.
    if (source !== SessionSource.IMPORT) {
      await assertGameReleased(this.prisma, entry.gameItemId);
    }

    const { session, playthrough } = await this.prisma.$transaction(
      async (tx) => {
        const playthrough = await this.resolvePlaythrough(
          tx,
          entry,
          occurredAt,
          dto.cycleAction,
        );
        const created = await tx.gameSession.create({
          data: {
            gameEntryId: entry.id,
            playthroughId: playthrough?.id ?? null,
            durationMinutes: dto.durationMinutes,
            notes: normalizeSessionNotes(dto.notes),
            occurredAt,
            source,
          },
        });

        if (playthrough) {
          await tx.gamePlaythrough.update({
            where: { id: playthrough.id },
            data: { trackedMinutes: { increment: dto.durationMinutes } },
          });
        }

        await tx.gameEntry.update({
          where: { id: entry.id },
          data: {
            trackedPlaytimeMinutes: { increment: dto.durationMinutes },
            ...(entry.steamPlaytimeMinutes === null
              ? { playtimeMinutes: { increment: dto.durationMinutes } }
              : {}),
            ...(playthrough ? { status: "PLAYING" as const } : {}),
            ...(playthrough && entry.startedAt === null
              ? { startedAt: occurredAt }
              : {}),
          },
        });
        return { session: created, playthrough };
      },
    );

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
      session: toDto(session, playthrough?.number ?? null),
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
      ? sessionDate(dto.occurredAt)
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
        if (before.playthroughId) {
          await tx.gamePlaythrough.update({
            where: { id: before.playthroughId },
            data: { trackedMinutes: { increment: delta } },
          });
        }

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
      session: toDto(session, before.playthrough?.number ?? null),
      summary: await this.summary(entry, 1),
      xpAwarded: false,
    };
  }

  async delete(userId: string, sessionId: string): Promise<void> {
    const session = await this.ownedSession(userId, sessionId);
    await this.prisma.$transaction(async (tx) => {
      await tx.gameSession.delete({ where: { id: sessionId } });
      let lifecycleData: Prisma.GameEntryUpdateInput = {};

      if (session.playthroughId) {
        const remainingInPlaythrough = await tx.gameSession.count({
          where: { playthroughId: session.playthroughId },
        });

        if (
          remainingInPlaythrough === 0 &&
          session.playthrough?.status === TrackingCycleStatus.ACTIVE
        ) {
          await tx.gamePlaythrough.delete({
            where: { id: session.playthroughId },
          });
          const previous = await tx.gamePlaythrough.findFirst({
            where: { gameEntryId: session.gameEntryId },
            orderBy: { number: "desc" },
          });
          lifecycleData = previous
            ? {
                status:
                  previous.status === TrackingCycleStatus.COMPLETED
                    ? "COMPLETED"
                    : previous.status === TrackingCycleStatus.DROPPED
                      ? "DROPPED"
                      : "PLAYING",
              }
            : { status: "BACKLOG", startedAt: null };
        } else {
          await tx.gamePlaythrough.update({
            where: { id: session.playthroughId },
            data: { trackedMinutes: { decrement: session.durationMinutes } },
          });
        }
      }

      await tx.gameEntry.update({
        where: { id: session.gameEntryId },
        data: {
          trackedPlaytimeMinutes: { decrement: session.durationMinutes },
          ...(session.gameEntry.steamPlaytimeMinutes === null
            ? { playtimeMinutes: { decrement: session.durationMinutes } }
            : {}),
          ...lifecycleData,
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
        include: { playthrough: { select: { number: true } } },
      }),
      this.prisma.gameEntry.findUniqueOrThrow({
        where: { id: entry.id },
        select: {
          user: { select: { timezone: true } },
          playthroughs: {
            where: { status: TrackingCycleStatus.ACTIVE },
            take: 1,
            select: {
              id: true,
              number: true,
              status: true,
              startedAt: true,
              finishedAt: true,
              trackedMinutes: true,
              legacyIncomplete: true,
              _count: { select: { sessions: true } },
            },
          },
        },
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
    const { items, hasMore } = toPagedResult(rows, PAGE_SIZE);
    return {
      items: items.map((session) =>
        toDto(session, session.playthrough?.number ?? null),
      ),
      hasMore,
      totalSessions,
      totalTrackedMinutes: entry.trackedPlaytimeMinutes,
      activePlaythrough: user.playthroughs[0]
        ? toPlaythroughDto(user.playthroughs[0])
        : null,
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
        playthrough: {
          select: { number: true, status: true },
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

  private async resolvePlaythrough(
    tx: Prisma.TransactionClient,
    entry: Awaited<ReturnType<GameSessionService["ownedEntry"]>>,
    occurredAt: Date,
    action?: (typeof SessionCycleAction)[keyof typeof SessionCycleAction],
  ): Promise<Pick<GamePlaythrough, "id" | "number"> | null> {
    if (action === SessionCycleAction.HISTORY_ONLY) return null;

    const active = await tx.gamePlaythrough.findFirst({
      where: {
        gameEntryId: entry.id,
        status: TrackingCycleStatus.ACTIVE,
      },
      orderBy: { number: "desc" },
    });
    if (active) return active;

    if (entry.status === "DROPPED" && action === SessionCycleAction.CONTINUE) {
      const dropped = await tx.gamePlaythrough.findFirst({
        where: {
          gameEntryId: entry.id,
          status: TrackingCycleStatus.DROPPED,
        },
        orderBy: { number: "desc" },
      });

      if (dropped) {
        return tx.gamePlaythrough.update({
          where: { id: dropped.id },
          data: { status: TrackingCycleStatus.ACTIVE, finishedAt: null },
        });
      }
    }

    const mayStart =
      entry.status === "BACKLOG" ||
      entry.status === "PLAYING" ||
      action === SessionCycleAction.RESTART;
    if (!mayStart) return null;

    const last = await tx.gamePlaythrough.aggregate({
      where: { gameEntryId: entry.id },
      _max: { number: true },
    });
    return tx.gamePlaythrough.create({
      data: {
        gameEntryId: entry.id,
        number: (last._max.number ?? 0) + 1,
        status: TrackingCycleStatus.ACTIVE,
        startedAt: occurredAt,
      },
    });
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

function toDto(
  session: GameSession,
  playthroughNumber: number | null = null,
): GameSessionDto {
  return {
    id: session.id,
    playthroughId: session.playthroughId,
    playthroughNumber,
    durationMinutes: session.durationMinutes,
    notes: session.notes,
    occurredAt: session.occurredAt.toISOString(),
    source: session.source,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
