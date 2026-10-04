import type { MediaSagaDto, SagaMemberDto } from "@loomkeep/shared";
import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { AnilistProvider } from "./providers/anilist.provider";
import type { TmdbProvider } from "./providers/tmdb.provider";
import { SagaSyncService } from "./saga-sync.service";

const film = (sourceId: string, upcoming = false): SagaMemberDto => ({
  source: "TMDB",
  sourceId,
  type: "MOVIE",
  title: `Film ${sourceId}`,
  year: upcoming ? null : 2021,
  posterUrl: null,
  isAdult: false,
  releaseDate: upcoming ? null : "2021-09-15",
  format: null,
  episodes: null,
  upcoming,
  status: null,
});

const dune = (...members: SagaMemberDto[]): MediaSagaDto => ({
  key: "TMDB:726871",
  title: "Dune - Saga",
  members,
});

function makeService({
  saga = dune(film("1"), film("2")),
  tracked = 1,
  known = [] as string[],
} = {}) {
  const prisma = {
    mediaItem: {
      count: vi.fn().mockResolvedValue(tracked),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    sagaMember: {
      findMany: vi
        .fn()
        .mockResolvedValue(known.map((sourceId) => ({ sourceId }))),
      upsert: vi.fn((args: unknown) => args),
      deleteMany: vi.fn((args: unknown) => args),
    },
    saga: { upsert: vi.fn((args: unknown) => args) },
    $transaction: vi.fn().mockResolvedValue([]),
  };
  const tmdb = {
    getSaga: vi.fn().mockResolvedValue(saga),
    getCollection: vi.fn().mockResolvedValue(saga),
  };
  const anilist = { getSaga: vi.fn().mockResolvedValue(saga) };
  const service = new SagaSyncService(
    prisma as unknown as PrismaService,
    tmdb as unknown as TmdbProvider,
    anilist as unknown as AnilistProvider,
  );
  return { service, prisma, tmdb, anilist };
}

const announced = (prisma: ReturnType<typeof makeService>["prisma"]) =>
  prisma.sagaMember.upsert.mock.calls.map(([args]) => {
    const { create } = args as {
      create: { sourceId: string; announcedAt: Date | null };
    };
    return [create.sourceId, create.announcedAt !== null];
  });

describe("SagaSyncService", () => {
  it("reads a franchise once for all of its works", async () => {
    const { service, anilist } = makeService();

    await service.read("ANIME", "1");
    await service.read("ANIME", "2");

    expect(anilist.getSaga).toHaveBeenCalledTimes(1);
  });

  it("announces a work that joins a saga already saved", async () => {
    const { service, prisma } = makeService({
      saga: dune(film("1"), film("2"), film("3", true)),
      known: ["1", "2"],
    });

    await service.sync("MOVIE", "1");

    expect(announced(prisma)).toEqual([
      ["1", false],
      ["2", false],
      ["3", true],
    ]);
    expect(prisma.mediaItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { sagaKey: "TMDB:726871" } }),
    );
  });

  it("announces nothing on a saga's first save, every work being new then", async () => {
    const { service, prisma } = makeService({ known: [] });

    await service.sync("MOVIE", "1");

    expect(announced(prisma)).toEqual([
      ["1", false],
      ["2", false],
    ]);
  });

  it("saves no saga none of whose works is tracked", async () => {
    const { service, prisma } = makeService({ tracked: 0 });

    await service.sync("MOVIE", "1");

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("reads a saved film saga in another language once a day, by its collection", async () => {
    const { service, tmdb } = makeService();

    await service.readCollection("TMDB:726871", ["1", "2"], "fr");
    await service.readCollection("TMDB:726871", ["1", "2"], "fr");

    expect(tmdb.getCollection).toHaveBeenCalledOnce();
    expect(tmdb.getCollection).toHaveBeenCalledWith("726871", "fr");
  });
});
