import {
  Domain,
  ErrorCode,
  MAX_SESSION_DURATION_MINUTES,
  type SessionTimerDto,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { SessionSource, type SessionTimer } from "@prisma/client";
import { BookSessionService } from "../books/book-session.service";
import { AppException } from "../common/app.exception";
import { assertGameReleased } from "../games/game-release.util";
import { GameSessionService } from "../games/game-session.service";
import { PrismaService } from "../prisma/prisma.service";
import { FinishSessionTimerDto } from "./dto/finish-session-timer.dto";
import { StartSessionTimerDto } from "./dto/start-session-timer.dto";

@Injectable()
export class SessionTimerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameSessions: GameSessionService,
    private readonly bookSessions: BookSessionService,
  ) {}

  async current(userId: string): Promise<SessionTimerDto | null> {
    const timer = await this.prisma.sessionTimer.findUnique({
      where: { userId },
    });
    return timer ? this.toDto(timer) : null;
  }

  async start(
    userId: string,
    dto: StartSessionTimerDto,
  ): Promise<SessionTimerDto> {
    const existing = await this.prisma.sessionTimer.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.LibrarySessionTimerAlreadyRunning,
      );
    }

    if (dto.domain === Domain.GAMES) {
      await this.assertGameOwnership(userId, dto.entryId);
    } else {
      await this.assertBookOwnership(userId, dto.entryId);
    }

    const timer = await this.prisma.sessionTimer.create({
      data: {
        userId,
        domain: dto.domain,
        gameEntryId: dto.domain === Domain.GAMES ? dto.entryId : null,
        bookEntryId: dto.domain === Domain.BOOKS ? dto.entryId : null,
        startedAt: new Date(),
        cycleAction: dto.cycleAction,
      },
    });
    return this.toDto(timer);
  }

  async pause(userId: string): Promise<SessionTimerDto> {
    const timer = await this.required(userId);
    if (timer.pausedAt) return this.toDto(timer);
    const now = new Date();
    const updated = await this.prisma.sessionTimer.update({
      where: { userId },
      data: {
        accumulatedSeconds: this.elapsedSeconds(timer, now),
        pausedAt: now,
      },
    });
    return this.toDto(updated, now);
  }

  async resume(userId: string): Promise<SessionTimerDto> {
    const timer = await this.required(userId);
    if (!timer.pausedAt) return this.toDto(timer);
    const updated = await this.prisma.sessionTimer.update({
      where: { userId },
      data: { startedAt: new Date(), pausedAt: null },
    });
    return this.toDto(updated);
  }

  async cancel(userId: string): Promise<void> {
    const deleted = await this.prisma.sessionTimer.deleteMany({
      where: { userId },
    });
    if (deleted.count === 0) this.notFound();
  }

  async finish(userId: string, dto: FinishSessionTimerDto): Promise<void> {
    const timer = await this.required(userId);
    const durationMinutes = Math.min(
      MAX_SESSION_DURATION_MINUTES,
      Math.max(1, Math.ceil(this.elapsedSeconds(timer) / 60)),
    );
    const occurredAt = new Date().toISOString();

    if (timer.domain === Domain.GAMES && timer.gameEntryId) {
      await this.gameSessions.create(
        userId,
        timer.gameEntryId,
        {
          durationMinutes,
          occurredAt,
          notes: dto.notes,
          cycleAction: dto.cycleAction ?? timer.cycleAction ?? undefined,
        },
        SessionSource.TIMER,
      );
    } else if (timer.domain === Domain.BOOKS && timer.bookEntryId) {
      await this.bookSessions.create(
        userId,
        timer.bookEntryId,
        {
          durationMinutes,
          occurredAt,
          notes: dto.notes,
          cycleAction: dto.cycleAction ?? timer.cycleAction ?? undefined,
          pagesRead: dto.pagesRead,
          startPage: dto.startPage,
          endPage: dto.endPage,
        },
        SessionSource.TIMER,
      );
    } else {
      this.notFound();
    }

    await this.prisma.sessionTimer.delete({ where: { userId } });
  }

  private async required(userId: string): Promise<SessionTimer> {
    const timer = await this.prisma.sessionTimer.findUnique({
      where: { userId },
    });
    if (!timer) this.notFound();
    return timer;
  }

  private elapsedSeconds(timer: SessionTimer, now = new Date()): number {
    if (timer.pausedAt) return timer.accumulatedSeconds;
    return (
      timer.accumulatedSeconds +
      Math.max(
        0,
        Math.floor((now.getTime() - timer.startedAt.getTime()) / 1000),
      )
    );
  }

  private toDto(timer: SessionTimer, now = new Date()): SessionTimerDto {
    const entryId = timer.gameEntryId ?? timer.bookEntryId;
    if (!entryId) this.notFound();
    return {
      id: timer.id,
      domain: timer.domain as SessionTimerDto["domain"],
      entryId,
      startedAt: timer.startedAt.toISOString(),
      pausedAt: timer.pausedAt?.toISOString() ?? null,
      elapsedSeconds: this.elapsedSeconds(timer, now),
    };
  }

  private async assertGameOwnership(userId: string, entryId: string) {
    const entry = await this.prisma.gameEntry.findUnique({
      where: { id: entryId },
      select: { userId: true, gameItemId: true },
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

    await assertGameReleased(this.prisma, entry.gameItemId);
  }

  private async assertBookOwnership(userId: string, entryId: string) {
    const entry = await this.prisma.bookEntry.findUnique({
      where: { id: entryId },
      select: { userId: true },
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
  }

  private notFound(): never {
    throw new AppException(
      HttpStatus.NOT_FOUND,
      ErrorCode.LibrarySessionTimerNotFound,
    );
  }
}
