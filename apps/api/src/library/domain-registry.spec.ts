import { Domain } from "@loomkeep/shared/enums";
import type { PrismaService } from "../prisma/prisma.service";
import { domainRegistry } from "../test-utils/domain-registry";

describe("DomainRegistry", () => {
  const registry = domainRegistry({} as PrismaService);

  it("files each adapter under its own domain", () => {
    for (const adapter of registry.all()) {
      expect(registry.get(adapter.domain)).toBe(adapter);
    }

    expect(registry.all().map((a) => a.domain)).toEqual([
      "MEDIA",
      "GAMES",
      "BOOKS",
      "MUSIC",
    ]);
  });

  it("has no adapter for the domains without tables yet", () => {
    expect(registry.has(Domain.PODCASTS)).toBe(false);
    expect(registry.has(Domain.BOARDGAMES)).toBe(false);
    expect(registry.has(Domain.BOOKS)).toBe(true);
    // An inherited key is not a domain.
    expect(registry.has("toString")).toBe(false);
  });

  it("merges every domain's keys of the account export", async () => {
    const empty = { findMany: () => Promise.resolve([]) };
    const merged = await domainRegistry({
      mediaEntry: empty,
      episodeWatch: empty,
      gameEntry: empty,
      bookEntry: empty,
      musicEntry: empty,
    } as unknown as PrismaService).exportEntries("u1");

    expect(merged).toEqual({
      library: [],
      episodeWatches: [],
      games: [],
      books: [],
      music: [],
    });
  });
});
