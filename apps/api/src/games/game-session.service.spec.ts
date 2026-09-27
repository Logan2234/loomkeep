import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameSessionService } from "./game-session.service";

describe("GameSessionService", () => {
  const created = {
    id: "session-1",
    gameEntryId: "entry-1",
    durationMinutes: 60,
    occurredAt: new Date("2024-09-26T12:00:00.000Z"),
    source: "MANUAL",
    createdAt: new Date("2024-09-26T12:01:00.000Z"),
    updatedAt: new Date("2024-09-26T12:01:00.000Z"),
  };
  const tx = {
    gameSession: { create: vi.fn() },
    gameEntry: { update: vi.fn() },
  };
  const prisma = {
    gameEntry: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    gameSession: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const activity = { emit: vi.fn() };
  const sessionXp = { awardForToday: vi.fn() };
  let service: GameSessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    tx.gameSession.create.mockResolvedValue(created);
    tx.gameEntry.update.mockResolvedValue({});
    prisma.$transaction.mockImplementation((run) => run(tx));
    prisma.gameEntry.findUniqueOrThrow.mockResolvedValue({
      user: { timezone: "UTC" },
    });
    prisma.gameSession.findMany
      .mockResolvedValueOnce([created])
      .mockResolvedValueOnce([
        { occurredAt: created.occurredAt, durationMinutes: 60 },
      ]);
    activity.emit.mockResolvedValue(undefined);
    sessionXp.awardForToday.mockResolvedValue(true);
    service = new GameSessionService(
      prisma as never,
      activity as never,
      sessionXp as never,
    );
  });

  it("keeps imported Steam playtime separate from Loomkeep sessions", async () => {
    prisma.gameEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      gameItemId: "game-1",
      status: "BACKLOG",
      startedAt: null,
      playtimeMinutes: 900,
      trackedPlaytimeMinutes: 0,
      steamPlaytimeMinutes: 900,
    });

    const result = await service.create("user-1", "entry-1", {
      durationMinutes: 60,
      occurredAt: "2024-09-26T12:00:00.000Z",
    });

    expect(tx.gameEntry.update).toHaveBeenCalledWith({
      where: { id: "entry-1" },
      data: {
        trackedPlaytimeMinutes: { increment: 60 },
        status: "PLAYING",
        startedAt: created.occurredAt,
      },
    });
    expect(result.summary.totalTrackedMinutes).toBe(60);
    expect(result.xpAwarded).toBe(true);
  });

  it("keeps the legacy total aligned when no Steam counter exists", async () => {
    prisma.gameEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      gameItemId: "game-1",
      status: "PLAYING",
      startedAt: created.occurredAt,
      playtimeMinutes: 30,
      trackedPlaytimeMinutes: 30,
      steamPlaytimeMinutes: null,
    });

    await service.create("user-1", "entry-1", {
      durationMinutes: 60,
      occurredAt: "2024-09-26T12:00:00.000Z",
    });

    expect(tx.gameEntry.update).toHaveBeenCalledWith({
      where: { id: "entry-1" },
      data: {
        trackedPlaytimeMinutes: { increment: 60 },
        playtimeMinutes: { increment: 60 },
      },
    });
  });
});
