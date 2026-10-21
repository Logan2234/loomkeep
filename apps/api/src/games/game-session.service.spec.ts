import { vi } from "vitest";
import { GameSessionService } from "./game-session.service";

describe("GameSessionService", () => {
  const created = {
    id: "session-1",
    gameEntryId: "entry-1",
    playthroughId: null,
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
    gamePlaythrough: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  const prisma = {
    gameEntry: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    gameSession: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    gameItem: { findUnique: vi.fn() },
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

  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.clearAllMocks();
    tx.gameSession.create.mockImplementation(({ data }) =>
      Promise.resolve({ ...created, playthroughId: data.playthroughId }),
    );
    tx.gameSession.delete.mockResolvedValue(created);
    tx.gameSession.count.mockResolvedValue(0);
    tx.gameEntry.update.mockResolvedValue({});
    tx.gamePlaythrough.aggregate.mockResolvedValue({ _max: { number: null } });
    tx.gamePlaythrough.findFirst.mockResolvedValue(null);
    tx.gamePlaythrough.update.mockImplementation(({ where, data }) =>
      Promise.resolve({
        id: where.id,
        number: 1,
        status: data.status ?? "ACTIVE",
        startedAt: created.occurredAt,
      }),
    );
    tx.gamePlaythrough.create.mockResolvedValue({
      id: "playthrough-1",
      number: 1,
      status: "ACTIVE",
      startedAt: created.occurredAt,
    });
    prisma.$transaction.mockImplementation((run) => run(tx));
    prisma.gameItem.findUnique.mockResolvedValue({
      releaseDate: new Date("2020-01-01T00:00:00.000Z"),
      releaseDatePrecision: "DAY",
    });
    prisma.gameEntry.findUniqueOrThrow.mockResolvedValue({
      user: { timezone: "UTC" },
      status: "PLAYING",
      gameItem: { timeToBeatNormallyMin: 1200 },
      playthroughs: [],
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

  it("estimates only the active playthrough, independently of Steam and history pagination", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
    prisma.gameEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      trackedPlaytimeMinutes: 9000,
      steamPlaytimeMinutes: 15000,
    });
    prisma.gameEntry.findUniqueOrThrow.mockResolvedValue({
      user: { timezone: "UTC" },
      status: "PLAYING",
      gameItem: { timeToBeatNormallyMin: 360 },
      playthroughs: [
        {
          id: "active",
          number: 2,
          status: "ACTIVE",
          trackedMinutes: 180,
          startedAt: new Date("2026-10-01"),
          finishedAt: null,
          legacyIncomplete: false,
          _count: { sessions: 3 },
        },
      ],
    });
    prisma.gameSession.findMany.mockReset();
    prisma.gameSession.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        ...[1, 8, 15].map((day) => ({
          occurredAt: new Date(
            `2026-10-${String(day).padStart(2, "0")}T12:00:00Z`,
          ),
          durationMinutes: 60,
          playthroughId: "active",
        })),
        {
          occurredAt: new Date("2026-10-20"),
          durationMinutes: 8000,
          playthroughId: "previous",
        },
        {
          occurredAt: new Date("2026-10-21"),
          durationMinutes: 8000,
          playthroughId: null,
        },
      ]);
    const summary = await service.list("user-1", "entry-1", 2);
    expect(summary.estimatedCompletionDate).toBe("2026-11-13");
    expect(summary.items).toEqual([]);
  });

  it.each(["BACKLOG", "COMPLETED", "DROPPED"])(
    "hides the estimate when the entry is %s",
    async (status) => {
      prisma.gameEntry.findUnique.mockResolvedValue({
        id: "entry-1",
        userId: "user-1",
        trackedPlaytimeMinutes: 0,
      });
      prisma.gameEntry.findUniqueOrThrow.mockResolvedValue({
        user: { timezone: "UTC" },
        status,
        gameItem: { timeToBeatNormallyMin: 1200 },
        playthroughs: [],
      });
      expect(
        (await service.list("user-1", "entry-1")).estimatedCompletionDate,
      ).toBeNull();
    },
  );

  it.each([null, 0, 180])(
    "hides the estimate without remaining game duration (%s)",
    async (target) => {
      prisma.gameEntry.findUnique.mockResolvedValue({
        id: "entry-1",
        userId: "user-1",
        trackedPlaytimeMinutes: 180,
      });
      prisma.gameEntry.findUniqueOrThrow.mockResolvedValue({
        user: { timezone: "UTC" },
        status: "PLAYING",
        gameItem: { timeToBeatNormallyMin: target },
        playthroughs: [
          {
            id: "active",
            number: 1,
            status: "ACTIVE",
            trackedMinutes: 180,
            startedAt: null,
            finishedAt: null,
            legacyIncomplete: false,
            _count: { sessions: 3 },
          },
        ],
      });
      expect(
        (await service.list("user-1", "entry-1")).estimatedCompletionDate,
      ).toBeNull();
    },
  );

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
        playthroughId: "playthrough-1",
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

  it("refuses a session on a game that isn't out, but not one Steam reports", async () => {
    prisma.gameEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      gameItemId: "game-1",
      status: "BACKLOG",
      startedAt: null,
      playtimeMinutes: 0,
      trackedPlaytimeMinutes: 0,
      steamPlaytimeMinutes: null,
    });
    prisma.gameItem.findUnique.mockResolvedValue({
      releaseDate: null,
      releaseDatePrecision: "TBD",
    });
    const dto = { durationMinutes: 60, occurredAt: "2024-09-26T12:00:00.000Z" };

    await expect(
      service.create("user-1", "entry-1", dto),
    ).rejects.toMatchObject({ code: "library.game_not_released" });
    await expect(
      service.create("user-1", "entry-1", dto, "IMPORT"),
    ).resolves.toBeDefined();
  });

  it("creates the first playthrough and links the first session to it", async () => {
    prisma.gameEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      gameItemId: "game-1",
      status: "BACKLOG",
      startedAt: null,
      playtimeMinutes: 0,
      trackedPlaytimeMinutes: 0,
      steamPlaytimeMinutes: null,
    });

    await service.create("user-1", "entry-1", {
      durationMinutes: 60,
      occurredAt: created.occurredAt.toISOString(),
    });

    expect(tx.gamePlaythrough.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gameEntryId: "entry-1",
        number: 1,
        status: "ACTIVE",
        startedAt: created.occurredAt,
      }),
    });
    expect(tx.gameSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ playthroughId: "playthrough-1" }),
    });
  });

  it("starts a new playthrough from zero after a completed game", async () => {
    prisma.gameEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      gameItemId: "game-1",
      status: "COMPLETED",
      startedAt: created.occurredAt,
      finishedAt: created.occurredAt,
      playtimeMinutes: 60,
      trackedPlaytimeMinutes: 60,
      steamPlaytimeMinutes: null,
    });
    tx.gamePlaythrough.aggregate.mockResolvedValue({ _max: { number: 2 } });
    tx.gamePlaythrough.create.mockResolvedValue({
      id: "playthrough-3",
      number: 3,
      status: "ACTIVE",
      startedAt: created.occurredAt,
    });

    await service.create("user-1", "entry-1", {
      durationMinutes: 60,
      occurredAt: created.occurredAt.toISOString(),
      cycleAction: "RESTART",
    });

    expect(tx.gamePlaythrough.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ number: 3, status: "ACTIVE" }),
    });
    expect(tx.gameSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ playthroughId: "playthrough-3" }),
    });
  });

  it("keeps a post-completion session outside playthrough progress", async () => {
    prisma.gameEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      gameItemId: "game-1",
      status: "COMPLETED",
      startedAt: created.occurredAt,
      finishedAt: created.occurredAt,
      playtimeMinutes: 60,
      trackedPlaytimeMinutes: 60,
      steamPlaytimeMinutes: null,
    });

    await service.create("user-1", "entry-1", {
      durationMinutes: 60,
      occurredAt: created.occurredAt.toISOString(),
      cycleAction: "HISTORY_ONLY",
    });

    expect(tx.gamePlaythrough.create).not.toHaveBeenCalled();
    expect(tx.gameSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ playthroughId: null }),
    });
    expect(tx.gameEntry.update.mock.calls[0]?.[0].data.status).toBeUndefined();
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
        status: "PLAYING",
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
    tx.gamePlaythrough.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "playthrough-1",
        number: 1,
        status: "DROPPED",
      });

    await service.create("user-1", "entry-1", {
      durationMinutes: 60,
      occurredAt: "2024-09-26T12:00:00.000Z",
      cycleAction: "CONTINUE",
    });

    expect(tx.gameEntry.update.mock.calls[0]?.[0].data.status).toBe("PLAYING");
  });

  it("resumes a completed game when the session explicitly requests it", async () => {
    prisma.gameEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      gameItemId: "game-1",
      status: "COMPLETED",
      startedAt: created.occurredAt,
      finishedAt: created.occurredAt,
      playtimeMinutes: 30,
      trackedPlaytimeMinutes: 30,
      steamPlaytimeMinutes: null,
    });

    await service.create("user-1", "entry-1", {
      durationMinutes: 60,
      occurredAt: "2024-09-26T12:00:00.000Z",
      cycleAction: "RESTART",
    });

    expect(tx.gameEntry.update.mock.calls[0]?.[0].data.status).toBe("PLAYING");
  });

  it("returns a playing game to the backlog when its only session is deleted", async () => {
    prisma.gameSession.findUnique.mockResolvedValue({
      ...created,
      playthroughId: "playthrough-1",
      playthrough: { number: 1, status: "ACTIVE" },
      gameEntry: {
        userId: "user-1",
        status: "PLAYING",
        steamPlaytimeMinutes: null,
      },
    });
    tx.gamePlaythrough.findFirst.mockResolvedValue(null);

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
