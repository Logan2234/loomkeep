import { Domain, ErrorCode } from "@loomkeep/shared";
import { SessionSource, type SessionTimer } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BookSessionService } from "../books/book-session.service";
import type { GameSessionService } from "../games/game-session.service";
import type { PrismaService } from "../prisma/prisma.service";
import { SessionTimerService } from "./session-timer.service";

const baseTimer: SessionTimer = {
  id: "timer-1",
  userId: "user-1",
  domain: Domain.GAMES,
  gameEntryId: "game-1",
  bookEntryId: null,
  startedAt: new Date("2026-09-28T12:00:00.000Z"),
  pausedAt: null,
  accumulatedSeconds: 30,
  resumeTracking: false,
  createdAt: new Date("2026-09-28T12:00:00.000Z"),
  updatedAt: new Date("2026-09-28T12:00:00.000Z"),
};

function makeService() {
  const prisma = {
    sessionTimer: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    gameEntry: { findUnique: vi.fn() },
    bookEntry: { findUnique: vi.fn() },
  } as unknown as PrismaService;
  const games = { create: vi.fn() } as unknown as GameSessionService;
  const books = { create: vi.fn() } as unknown as BookSessionService;
  return {
    service: new SessionTimerService(prisma, games, books),
    prisma: prisma as unknown as {
      sessionTimer: Record<string, ReturnType<typeof vi.fn>>;
      gameEntry: { findUnique: ReturnType<typeof vi.fn> };
    },
    games: games as unknown as { create: ReturnType<typeof vi.fn> },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("SessionTimerService", () => {
  it("returns a durable elapsed time from the stored timer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T12:01:00.000Z"));
    const { service, prisma } = makeService();
    prisma.sessionTimer.findUnique.mockResolvedValue(baseTimer);

    await expect(service.current("user-1")).resolves.toEqual(
      expect.objectContaining({ elapsedSeconds: 90, entryId: "game-1" }),
    );
  });

  it("rejects a second active timer", async () => {
    const { service, prisma } = makeService();
    prisma.sessionTimer.findUnique.mockResolvedValue({ id: "timer-1" });

    await expect(
      service.start("user-1", { domain: Domain.GAMES, entryId: "game-1" }),
    ).rejects.toMatchObject({
      code: ErrorCode.LibrarySessionTimerAlreadyRunning,
    });
  });

  it("creates a timer session with a rounded-up duration before deleting it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T12:01:01.000Z"));
    const { service, prisma, games } = makeService();
    prisma.sessionTimer.findUnique.mockResolvedValue(baseTimer);
    games.create.mockResolvedValue({});
    prisma.sessionTimer.delete.mockResolvedValue(baseTimer);

    await service.finish("user-1", { notes: "Boss attempt" });

    expect(games.create).toHaveBeenCalledWith(
      "user-1",
      "game-1",
      expect.objectContaining({
        durationMinutes: 2,
        notes: "Boss attempt",
      }),
      SessionSource.TIMER,
    );
    expect(prisma.sessionTimer.delete).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });
});
