import { vi } from "vitest";
import type { EventsGateway } from "../events/events.gateway";
import type { AchievementService } from "../gamification/achievements/achievement.service";
import type { XpService } from "../gamification/xp.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AgeGateService } from "../users/age-gate.service";
import type { GameItemService } from "./game-item.service";
import { GameLibraryService } from "./game-library.service";

function stubXp(): XpService {
  return {
    award: vi.fn(),
    awardMany: vi.fn(),
    revokeBySource: vi.fn(),
  } as unknown as XpService;
}

function stubAchievements(): AchievementService {
  return { evaluate: vi.fn() } as unknown as AchievementService;
}

function stubEvents(): EventsGateway {
  return { emitToUser: vi.fn() } as unknown as EventsGateway;
}

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  const id = (overrides.id as string) ?? "entry-1";
  return {
    id,
    userId: "user-1",
    gameItemId: `game-${id}`,
    status: overrides.status ?? "BACKLOG",
    rating: overrides.rating ?? null,
    notes: null,
    favorite: overrides.favorite ?? false,
    playtimeMinutes: overrides.playtimeMinutes ?? 0,
    startedAt: null,
    finishedAt: overrides.finishedAt ?? null,
    ownershipStatus: "NONE",
    ownershipSource: null,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    replays: [],
    gameItem: {
      id: `game-${id}`,
      title: overrides.title ?? "Hades",
      coverUrl: null,
      canonicalSource: "IGDB",
      externalIds: [{ source: "IGDB", externalId: `igdb-${id}` }],
    },
  };
}

describe("GameLibraryService.deleteEntry", () => {
  it("wipes the user's reviews and comments for the game, not just the entry row", async () => {
    const reviewDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const commentUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const gameEntryDelete = vi.fn().mockResolvedValue({});

    const prisma = {
      gameEntry: {
        findUnique: vi.fn().mockResolvedValue({
          id: "entry-1",
          userId: "user-1",
          gameItemId: "game-1",
        }),
        delete: gameEntryDelete,
      },
      review: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: reviewDeleteMany,
      },
      comment: { updateMany: commentUpdateMany },
      gameReplay: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;
    const xp = stubXp();

    const service = new GameLibraryService(
      prisma,
      {} as GameItemService,
      {} as AgeGateService,
      {} as import("../reviews/review.service").ReviewService,
      {
        emit: vi.fn(),
      } as unknown as import("../social/activity.service").ActivityService,
      xp,
      stubAchievements(),
      stubEvents(),
    );

    await service.deleteEntry("user-1", "entry-1");

    expect(reviewDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", targetId: { in: ["game-1"] } },
    });
    expect(commentUpdateMany).toHaveBeenCalledWith({
      where: {
        authorId: "user-1",
        targetId: { in: ["game-1"] },
        deletedAt: null,
      },
      data: { text: null, deletedAt: expect.any(Date) },
    });
    expect(gameEntryDelete).toHaveBeenCalledWith({ where: { id: "entry-1" } });
    expect(xp.revokeBySource).toHaveBeenCalledWith("GameEntry", ["entry-1"]);
    expect(xp.revokeBySource).toHaveBeenCalledWith("Entry", ["entry-1"]);
  });
});

describe("GameLibraryService — XP wiring", () => {
  const reviews = {
    getRating: vi.fn().mockResolvedValue(null),
    setRating: vi.fn(),
  } as unknown as import("../reviews/review.service").ReviewService;
  const activity = {
    emit: vi.fn(),
  } as unknown as import("../social/activity.service").ActivityService;

  it("awards WORK_ADDED + DOMAIN_STARTED on creation only, and GAME_FINISHED on the COMPLETED transition", async () => {
    const findUnique = vi.fn().mockResolvedValueOnce(null); // before: null -> creation
    const upsert = vi
      .fn()
      .mockResolvedValue({ ...makeRow({ id: "e1" }), status: "COMPLETED" });
    const count = vi.fn().mockResolvedValue(1);
    const prisma = {
      gameEntry: { findUnique, upsert, count },
    } as unknown as PrismaService;
    const xp = stubXp();
    const events = stubEvents();

    const service = new GameLibraryService(
      prisma,
      {
        upsertFromSource: vi.fn().mockResolvedValue({ id: "game-1" }),
      } as unknown as GameItemService,
      {} as AgeGateService,
      reviews,
      activity,
      xp,
      stubAchievements(),
      events,
    );

    await service.upsertEntry("user-1", {
      source: "IGDB",
      sourceId: "igdb-1",
      status: "COMPLETED",
    } as never);

    expect(xp.award).toHaveBeenCalledWith("user-1", "WORK_ADDED", "e1");
    expect(xp.award).toHaveBeenCalledWith("user-1", "DOMAIN_STARTED", "GAMES");
    expect(xp.award).toHaveBeenCalledWith("user-1", "GAME_FINISHED", "e1");
    expect(events.emitToUser).toHaveBeenCalledWith(
      "user-1",
      "onboarding-updated",
    );
  });

  it("awards GAME_REPLAYED on addReplay and revokes it on deleteReplay", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: "e1", userId: "user-1" });
    const gameEntryFindUniqueOrThrow = vi
      .fn()
      .mockResolvedValue(makeRow({ id: "e1" }));
    const replayCreate = vi.fn().mockResolvedValue({ id: "replay-1" });
    const prisma = {
      gameEntry: {
        findUnique,
        findUniqueOrThrow: gameEntryFindUniqueOrThrow,
      },
      gameReplay: {
        create: replayCreate,
        findUnique: vi.fn().mockResolvedValue({
          id: "replay-1",
          gameEntry: { userId: "user-1" },
        }),
        delete: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;
    const xp = stubXp();

    const service = new GameLibraryService(
      prisma,
      {} as GameItemService,
      {} as AgeGateService,
      reviews,
      activity,
      xp,
      stubAchievements(),
      stubEvents(),
    );

    await service.addReplay("user-1", "e1", {} as never);
    expect(xp.award).toHaveBeenCalledWith(
      "user-1",
      "GAME_REPLAYED",
      "replay-1",
    );

    await service.deleteReplay("user-1", "replay-1");
    expect(xp.revokeBySource).toHaveBeenCalledWith("GameReplay", ["replay-1"]);
  });
});
