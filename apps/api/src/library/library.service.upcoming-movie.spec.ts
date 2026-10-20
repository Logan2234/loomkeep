import { vi } from "vitest";
import { LibraryService } from "./library.service";

function makeService(overrides: Record<string, unknown> = {}) {
  const movie = {
    id: "movie-1",
    type: "MOVIE",
    title: "Future movie",
    status: "Post Production",
    releaseDate: new Date("2099-12-18"),
    movieReleaseDates: [{ country: "US", date: "2099-12-18", type: 3 }],
    canonicalSource: "TMDB",
    externalIds: [{ source: "TMDB", externalId: "1" }],
    posterUrl: null,
    ...overrides,
  };
  const row = {
    id: "entry-1",
    userId: "user-1",
    mediaItemId: movie.id,
    mediaItem: movie,
    status: "PLANNED",
    favorite: false,
    finishedAt: null,
    startedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ownershipStatus: "NONE",
    ownershipSource: null,
    replays: [],
  };
  const update = vi.fn().mockResolvedValue(row);
  const upsert = vi.fn().mockResolvedValue(row);
  const replayCreate = vi.fn();
  const prisma = {
    libraryEntry: {
      findUnique: vi.fn().mockResolvedValue(row),
      update,
      upsert,
    },
    mediaItem: {
      findUnique: vi.fn().mockResolvedValue(movie),
      findUniqueOrThrow: vi.fn().mockResolvedValue(movie),
    },
    movieReplay: { create: replayCreate },
    episode: { findMany: vi.fn().mockResolvedValue([]) },
    episodeWatch: {
      aggregate: vi.fn().mockResolvedValue({ _max: { watchedAt: null } }),
    },
  };
  const service = new LibraryService(
    prisma as never,
    { upsertFromSource: vi.fn().mockResolvedValue(movie) } as never,
    {} as never,
    { getRating: vi.fn().mockResolvedValue(null) } as never,
    { emit: vi.fn() } as never,
    { award: vi.fn() } as never,
    { evaluate: vi.fn() } as never,
    { emitToUser: vi.fn() } as never,
    {} as never,
  );
  return { service, update, upsert, replayCreate };
}

describe("unreleased movie tracking", () => {
  it("rejects marking an unreleased movie as watched before writing progress", async () => {
    const { service, update } = makeService();
    await expect(
      service.updateEntry("user-1", "entry-1", { status: "COMPLETED" }),
    ).rejects.toMatchObject({ code: "library.movie_not_released" });
    expect(update).not.toHaveBeenCalled();
  });
  it("rejects a rating before writing the library entry", async () => {
    const { service, update } = makeService();
    await expect(
      service.updateEntry("user-1", "entry-1", { rating: 8 }),
    ).rejects.toMatchObject({ code: "library.movie_not_released" });
    expect(update).not.toHaveBeenCalled();
  });
  it("rejects an initial completed entry without creating it", async () => {
    const { service, upsert } = makeService();
    await expect(
      service.upsertEntry("user-1", {
        source: "TMDB",
        sourceId: "1",
        type: "MOVIE",
        status: "COMPLETED",
      }),
    ).rejects.toMatchObject({ code: "library.movie_not_released" });
    expect(upsert).not.toHaveBeenCalled();
  });
  it("rejects a rewatch before creating history or granting XP", async () => {
    const { service, replayCreate } = makeService();
    await expect(
      service.addReplay("user-1", "entry-1", {}),
    ).rejects.toMatchObject({ code: "library.movie_not_released" });
    expect(replayCreate).not.toHaveBeenCalled();
  });
});

describe("unaired anime tracking", () => {
  const anime = {
    type: "ANIME",
    status: "NOT_YET_RELEASED",
    releaseDate: new Date("2099-01-10"),
    movieReleaseDates: null,
    canonicalSource: "ANILIST",
    externalIds: [{ source: "ANILIST", externalId: "1" }],
  };

  it("rejects completing or rating it before writing the entry", async () => {
    const { service, update } = makeService(anime);
    await expect(
      service.updateEntry("user-1", "entry-1", { status: "COMPLETED" }),
    ).rejects.toMatchObject({ code: "library.anime_not_aired" });
    await expect(
      service.updateEntry("user-1", "entry-1", { rating: 8 }),
    ).rejects.toMatchObject({ code: "library.anime_not_aired" });
    expect(update).not.toHaveBeenCalled();
  });
  it("can still be followed, flagged as upcoming", async () => {
    const { service, upsert } = makeService(anime);
    const entry = await service.upsertEntry("user-1", {
      source: "ANILIST",
      sourceId: "1",
      type: "ANIME",
      status: "PLANNED",
    });
    expect(upsert).toHaveBeenCalled();
    expect(entry.mediaItem.upcoming).toBe(true);
  });
});
