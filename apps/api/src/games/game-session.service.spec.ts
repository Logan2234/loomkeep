import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameSessionService } from "./game-session.service";

describe("GameSessionService", () => {
  const created = {
    id: "session-1",
    gameEntryId: "entry-1",
    durationMinutes: 60,
    notes: "Beat the final boss.",
    occurredAt: new Date("2024-09-26T12:00:00.000Z"),
    source: "MANUAL",
    createdAt: new Date("2024-09-26T12:01:00.000Z"),
    updatedAt: new Date("2024-09-26T12:01:00.000Z"),
  };
  const tx = {
    gameSession: { count: vi.fn(), create: vi.fn(), delete: vi.fn() },
    gameEntry: { update: vi.fn() },
  };
  const prisma = {
    gameEntry: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    gameSession: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  const activity = {
    deleteLinked: vi.fn(),
    emit: vi.fn(),
  };
  const sessionXp = {
    awardForToday: vi.fn(),
    refreshAfterDelete: vi.fn(),
  };
  let service: GameSessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    tx.gameSession.create.mockResolvedValue(created);
    tx.gameSession.delete.mockResolvedValue(created);
    tx.gameSession.count.mockResolvedValue(0);
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
    prisma.gameSession.count.mockResolvedValue(1);
    activity.emit.mockResolvedValue(undefined);
    activity.deleteLinked.mockResolvedValue(undefined);
    sessionXp.awardForToday.mockResolvedValue(true);
    sessionXp.refreshAfterDelete.mockResolvedValue(undefined);
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
      notes: "  Beat the final boss.  ",
    });

    expect(tx.gameSession.create).toHaveBeenCalledWith({
      data: {
        gameEntryId: "entry-1",
        durationMinutes: 60,
        notes: "Beat the final boss.",
        occurredAt: created.occurredAt,
        source: "MANUAL",
      },
    });
    expect(activity.emit.mock.calls[0]?.[0].data).not.toHaveProperty("notes");

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

  it.each(["COMPLETED", "DROPPED"])(
    "does not override an explicitly chosen %s status",
    async (status) => {
      prisma.gameEntry.findUnique.mockResolvedValue({
        id: "entry-1",
        userId: "user-1",
        gameItemId: "game-1",
        status,
        startedAt: created.occurredAt,
        playtimeMinutes: 30,
        trackedPlaytimeMinutes: 30,
        steamPlaytimeMinutes: null,
      });

      await service.create("user-1", "entry-1", {
        durationMinutes: 60,
        occurredAt: "2024-09-26T12:00:00.000Z",
      });

      const update = tx.gameEntry.update.mock.calls[0]?.[0];
      expect(update.data.status).toBeUndefined();
    },
  );

  it("resumes a dropped game only when the session explicitly requests it", async () => {
    prisma.gameEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      gameItemId: "game-1",
      status: "DROPPED",
      startedAt: created.occurredAt,
      playtimeMinutes: 30,
      trackedPlaytimeMinutes: 30,
      steamPlaytimeMinutes: null,
    });

    await service.create("user-1", "entry-1", {
      durationMinutes: 60,
      occurredAt: "2024-09-26T12:00:00.000Z",
      resumeTracking: true,
    });

    expect(tx.gameEntry.update.mock.calls[0]?.[0].data.status).toBe("PLAYING");
  });

  it("returns a playing game to the backlog when its only session is deleted", async () => {
    prisma.gameSession.findUnique.mockResolvedValue({
      ...created,
      gameEntry: {
        userId: "user-1",
        status: "PLAYING",
        steamPlaytimeMinutes: null,
      },
    });

    await service.delete("user-1", "session-1");

    expect(tx.gameEntry.update).toHaveBeenCalledWith({
      where: { id: "entry-1" },
      data: {
        trackedPlaytimeMinutes: { decrement: 60 },
        playtimeMinutes: { decrement: 60 },
        status: "BACKLOG",
        startedAt: null,
      },
    });
  });
});
