import { describe, expect, it, vi } from "vitest";
import type { TmdbProvider } from "../catalog/providers/tmdb.provider";
import type { IgdbProvider } from "../games/providers/igdb.provider";
import type { PrismaService } from "../prisma/prisma.service";
import { SHOWCASE_MIN_FOLLOWERS, ShowcaseService } from "./showcase.service";

function makeService({
  tmdb = () => Promise.resolve(["tmdb-1", "tmdb-2"]),
  igdb = () => Promise.resolve(["igdb-1"]),
}: {
  tmdb?: () => Promise<string[]>;
  igdb?: () => Promise<string[]>;
} = {}) {
  const prisma = {
    bookEntry: {
      groupBy: vi.fn().mockResolvedValue([{ bookItemId: "b1" }]),
    },
    bookItem: {
      findMany: vi.fn().mockResolvedValue([{ coverUrl: "book-1" }]),
    },
    musicEntry: { groupBy: vi.fn().mockResolvedValue([]) },
    musicItem: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const trendingPosters = vi.fn(tmdb);
  const service = new ShowcaseService(
    prisma as unknown as PrismaService,
    { trendingPosters } as unknown as TmdbProvider,
    { popularCovers: vi.fn(igdb) } as unknown as IgdbProvider,
  );
  return { service, prisma, trendingPosters };
}

describe("ShowcaseService", () => {
  it("mixes trending films, series and games with the instance's most followed books", async () => {
    const { service } = makeService();

    await expect(service.get()).resolves.toEqual({
      posters: ["tmdb-1", "tmdb-2", "igdb-1", "book-1"],
    });
  });

  it("only takes books and albums followed widely enough to say nothing of one account", async () => {
    const { service, prisma } = makeService();

    await service.get();

    for (const [table, key] of [
      [prisma.bookEntry, "bookItemId"],
      [prisma.musicEntry, "musicItemId"],
    ] as const) {
      expect(table.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          having: { [key]: { _count: { gte: SHOWCASE_MIN_FOLLOWERS } } },
        }),
      );
    }
  });

  it("leaves out a catalog that fails or isn't configured", async () => {
    const { service } = makeService({
      tmdb: () => Promise.reject(new Error("TMDB_API_TOKEN missing")),
    });

    await expect(service.get()).resolves.toEqual({
      posters: ["igdb-1", "book-1"],
    });
  });

  it("asks the catalogs once a day, whoever opens the page", async () => {
    const { service, trendingPosters } = makeService();

    await service.get();
    await service.get();

    expect(trendingPosters).toHaveBeenCalledOnce();
  });
});
