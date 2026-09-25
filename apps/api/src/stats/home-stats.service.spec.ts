import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { DomainGateService } from "../users/domain-gate.service";
import { HomeStatsService } from "./home-stats.service";

function makeService(enabled: string[], prisma: Record<string, unknown>) {
  return new HomeStatsService(
    prisma as unknown as PrismaService,
    {
      getEnabledDomains: vi.fn().mockResolvedValue(enabled),
    } as unknown as DomainGateService,
  );
}

describe("HomeStatsService.onThisDay", () => {
  const show = (id: string, title: string) => ({
    id,
    title,
    posterUrl: null,
    type: "SERIES",
    canonicalSource: "TMDB",
    externalIds: [{ source: "TMDB", externalId: id }],
  });
  const watch = (item: ReturnType<typeof show>, at: string) => ({
    watchedAt: new Date(at),
    episode: { season: { mediaItem: item } },
  });

  it("shows each series once, with the episodes watched that week", async () => {
    const severance = show("95396", "Severance");
    const service = makeService(["MEDIA"], {
      episodeWatch: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            watch(severance, "2025-09-24T20:00:00Z"),
            watch(severance, "2025-09-25T21:00:00Z"),
          ]),
      },
      libraryEntry: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const entries = await service.onThisDay("user-1", "2026-09-25");

    expect(entries).toEqual([
      {
        domain: "MEDIA",
        title: "Severance",
        imageUrl: null,
        href: "/app/media/series/95396",
        kind: "watched",
        date: "2025-09-25T21:00:00.000Z",
        count: 2,
      },
    ]);
  });

  it("shows a book finished that week as finished, not started", async () => {
    const service = makeService(["BOOKS"], {
      bookEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            startedAt: new Date("2025-09-23T08:00:00Z"),
            finishedAt: new Date("2025-09-26T08:00:00Z"),
            replays: [],
            bookItem: {
              title: "Dune",
              coverUrl: null,
              canonicalSource: "OPEN_LIBRARY",
              externalIds: [{ source: "OPEN_LIBRARY", externalId: "OL1W" }],
            },
          },
        ]),
      },
    });

    const [entry] = await service.onThisDay("user-1", "2026-09-25");

    expect(entry).toMatchObject({
      kind: "finished",
      href: "/app/books/OL1W",
    });
  });
});
