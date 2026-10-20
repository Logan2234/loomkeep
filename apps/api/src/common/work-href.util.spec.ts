import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { resolveWorkHref, resolveWorkLink } from "./work-href.util";

const item = (over: Record<string, unknown> = {}) => ({
  title: "Hades",
  canonicalSource: "IGDB",
  externalIds: [
    { source: "STEAM", externalId: "1145360" },
    { source: "IGDB", externalId: "113112" },
  ],
  ...over,
});

function prismaWith(row: unknown): PrismaService {
  const findUnique = vi.fn().mockResolvedValue(row);
  return {
    mediaItem: { findUnique },
    gameItem: { findUnique },
    bookItem: { findUnique },
    musicItem: { findUnique },
  } as unknown as PrismaService;
}

describe("resolveWorkLink", () => {
  it.each([
    ["GAME", "/app/games/113112"],
    ["BOOK", "/app/books/113112"],
    ["MUSIC", "/app/music/113112"],
  ])("links a %s to its page under its canonical id", async (type, href) => {
    expect(await resolveWorkLink(prismaWith(item()), type, "w1")).toEqual({
      href,
      title: "Hades",
    });
  });

  it("puts a film or series under its own media type", async () => {
    const prisma = prismaWith(
      item({
        title: "Severance",
        type: "SERIES",
        canonicalSource: "TMDB",
        externalIds: [{ source: "TMDB", externalId: "95396" }],
      }),
    );

    expect(await resolveWorkLink(prisma, "MEDIA", "m1")).toEqual({
      href: "/app/media/series/95396",
      title: "Severance",
    });
  });

  it("gives nothing for a missing work, one without its canonical id, or an episode", async () => {
    expect(await resolveWorkLink(prismaWith(null), "GAME", "w1")).toBeNull();
    expect(await resolveWorkLink(prismaWith(null), "MEDIA", "m1")).toBeNull();
    expect(
      await resolveWorkLink(
        prismaWith(item({ externalIds: [] })),
        "BOOK",
        "b1",
      ),
    ).toBeNull();
    expect(
      await resolveWorkLink(prismaWith(item()), "EPISODE", "e1"),
    ).toBeNull();
  });

  it("backs resolveWorkHref, which keeps only the link", async () => {
    expect(await resolveWorkHref(prismaWith(item()), "GAME", "w1")).toBe(
      "/app/games/113112",
    );
  });
});
