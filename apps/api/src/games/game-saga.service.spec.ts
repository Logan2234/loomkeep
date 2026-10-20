import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { AgeGateService } from "../users/age-gate.service";
import { GameSagaService } from "./game-saga.service";
import type { ProviderGameSaga } from "./providers/game-provider.types";
import type { IgdbProvider } from "./providers/igdb.provider";

const game = (sourceId: string, upcoming = false) => ({
  source: "IGDB" as const,
  sourceId,
  title: `The Witcher ${sourceId}`,
  year: upcoming ? null : 2015,
  coverUrl: null,
  isAdult: false,
  releaseDate: upcoming ? null : "2015-05-19",
  releaseDatePrecision: upcoming ? ("TBD" as const) : ("DAY" as const),
  upcoming,
});

const WITCHER: ProviderGameSaga = {
  key: "IGDB:117",
  title: "The Witcher",
  members: [game("1"), game("2"), game("3"), game("4", true)],
};

const savedMember = (sourceId: string, upcoming = false) => ({
  id: `m-${sourceId}`,
  sagaKey: "IGDB:117",
  sourceId,
  position: Number(sourceId),
  title: `The Witcher ${sourceId}`,
  coverUrl: null,
  releaseDate: upcoming ? null : "2015-05-19",
  releaseDatePrecision: upcoming ? "TBD" : "DAY",
  isAdult: false,
  upcoming,
  announcedAt: null,
  notifiedAt: null,
  createdAt: new Date(),
});

function makeService({
  statuses = {} as Record<string, string>,
  known = [] as string[],
  tagged = 0,
  saved = [
    savedMember("1"),
    savedMember("2"),
    savedMember("3"),
    savedMember("4", true),
  ],
} = {}) {
  const getSaga = vi.fn().mockResolvedValue(WITCHER);
  const prisma = {
    gameEntry: {
      findMany: vi.fn((args: { select: object }) =>
        Promise.resolve(
          "status" in args.select
            ? Object.entries(statuses).map(([id, status]) => ({
                status,
                gameItem: { externalIds: [{ externalId: id }] },
              }))
            : [
                {
                  updatedAt: new Date("2026-10-01T00:00:00Z"),
                  finishedAt: new Date("2026-09-30T00:00:00Z"),
                  gameItem: { sagaKey: "IGDB:117" },
                },
              ],
        ),
      ),
    },
    gameItem: {
      updateMany: vi.fn().mockResolvedValue({ count: tagged }),
      count: vi.fn().mockResolvedValue(1),
    },
    gameSaga: {
      findUnique: vi.fn().mockResolvedValue({
        key: "IGDB:117",
        title: "The Witcher",
        members: saved,
      }),
      findMany: vi.fn().mockResolvedValue([
        {
          key: "IGDB:117",
          title: "The Witcher",
          members: [
            savedMember("1"),
            savedMember("2"),
            savedMember("3"),
            savedMember("4", true),
          ],
        },
      ]),
      upsert: vi.fn((args: unknown) => args),
    },
    gameSagaMember: {
      findMany: vi
        .fn()
        .mockResolvedValue(known.map((sourceId) => ({ sourceId }))),
      upsert: vi.fn((args: unknown) => args),
      deleteMany: vi.fn((args: unknown) => args),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  };
  const service = new GameSagaService(
    prisma as unknown as PrismaService,
    { getSaga } as unknown as IgdbProvider,
    {
      allowsAdultContent: vi.fn().mockResolvedValue(true),
    } as unknown as AgeGateService,
  );
  return { service, prisma, getSaga };
}

const announced = (prisma: ReturnType<typeof makeService>["prisma"]) =>
  prisma.gameSagaMember.upsert.mock.calls.map(([args]) => {
    const { create } = args as {
      create: { sourceId: string; announcedAt: Date | null };
    };
    return [create.sourceId, create.announcedAt !== null];
  });

describe("GameSagaService", () => {
  it("reads a series once for all of its games", async () => {
    const { service, getSaga } = makeService();

    await service.read("1");
    await service.read("3");

    expect(getSaga).toHaveBeenCalledOnce();
  });

  it("gives each game the player's status", async () => {
    const { service } = makeService({ statuses: { "1": "COMPLETED" } });

    const saga = await service.getSaga("u1", "2");

    expect(saga?.members.map((m) => [m.sourceId, m.status])).toEqual([
      ["1", "COMPLETED"],
      ["2", null],
      ["3", null],
      ["4", null],
    ]);
  });

  it("announces a game that joins a series already saved", async () => {
    const { service, prisma } = makeService({ known: ["1", "2", "3"] });

    await service.sync("1");

    expect(announced(prisma)).toEqual([
      ["1", false],
      ["2", false],
      ["3", false],
      ["4", true],
    ]);
  });

  it("lists a series played through and waiting on an announced game", async () => {
    const { service } = makeService({
      statuses: { "1": "COMPLETED", "2": "COMPLETED", "3": "DROPPED" },
    });

    const sagas = await service.listSagas("u1");

    expect(sagas.waiting).toEqual([
      expect.objectContaining({
        key: "IGDB:117",
        next: expect.objectContaining({ sourceId: "4", upcoming: true }),
        seen: 2,
        released: 3,
      }),
    ]);
  });
});

describe("GameSagaService.completed", () => {
  const finishedAll = { 1: "COMPLETED", 2: "COMPLETED", 3: "COMPLETED" };

  it("counts the games of a series finished through, nothing announced", async () => {
    const { service } = makeService({
      statuses: finishedAll,
      saved: [savedMember("1"), savedMember("2"), savedMember("3")],
    });

    await expect(service.completed("user-1", "IGDB:117")).resolves.toEqual({
      title: "The Witcher",
      works: 3,
    });
  });

  it("isn't completed while a game is announced", async () => {
    const { service } = makeService({ statuses: finishedAll });

    await expect(service.completed("user-1", "IGDB:117")).resolves.toBeNull();
  });
});
