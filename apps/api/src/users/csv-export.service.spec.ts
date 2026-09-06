import { Domain, ErrorCode } from "@loomkeep/shared";
import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { ReviewService } from "../reviews/review.service";
import { CsvExportService } from "./csv-export.service";

const ITEM_ID_FIELD: Record<string, string> = {
  libraryEntry: "mediaItemId",
  gameEntry: "gameItemId",
  bookEntry: "bookItemId",
  musicEntry: "musicItemId",
};

// Ratings now come from Review: tag each row with an item id and mock the
// ReviewService so getRatings projects the row's rating back into the export.
function makeService(model: string, rows: Record<string, unknown>[]) {
  const idField = ITEM_ID_FIELD[model];
  rows.forEach((r, i) => (r[idField] = `${model}-${i}`));
  const prisma = {
    [model]: { findMany: vi.fn().mockResolvedValue(rows) },
  } as unknown as PrismaService;
  const ratings = new Map(
    rows
      .filter((r) => r.rating !== null)
      .map((r) => [r[idField] as string, r.rating as number]),
  );
  const reviews = {
    getRatings: vi.fn(() => Promise.resolve(ratings)),
  } as unknown as ReviewService;
  return new CsvExportService(prisma, reviews);
}

describe("CsvExportService.buildCsv", () => {
  it("builds a MEDIA CSV with the expected header and one row per entry", async () => {
    const service = makeService("libraryEntry", [
      {
        status: "WATCHING",
        rating: 8,
        notes: "great",
        favorite: true,
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
        finishedAt: null,
        ownershipStatus: "NONE",
        ownershipSource: null,
        mediaItem: {
          title: "Dune",
          type: "MOVIE",
          releaseDate: new Date("2021-10-22T00:00:00.000Z"),
          genres: ["Sci-Fi", "Drama"],
        },
      },
    ]);

    const csv = await service.buildCsv("user-1", Domain.MEDIA);
    const [header, row] = csv.split("\r\n");

    expect(header).toBe(
      "Title,Type,Status,Rating,Notes,Favorite,Started At,Finished At,Ownership Status,Ownership Source,Release Date,Genres",
    );
    expect(row).toBe(
      "Dune,MOVIE,WATCHING,8,great,true,2026-01-01,,NONE,,2021-10-22,Sci-Fi; Drama",
    );
  });

  it("builds a GAMES CSV including playtime and replay count", async () => {
    const service = makeService("gameEntry", [
      {
        status: "PLAYING",
        rating: null,
        notes: null,
        favorite: false,
        playtimeMinutes: 120,
        startedAt: null,
        finishedAt: null,
        ownershipStatus: "DIGITAL",
        ownershipSource: "Steam",
        gameItem: {
          title: "Hades",
          releaseDate: new Date("2020-09-17T00:00:00.000Z"),
          genres: ["Roguelike"],
          platforms: ["PC"],
        },
        replays: [{}, {}],
      },
    ]);

    const csv = await service.buildCsv("user-1", Domain.GAMES);
    const [, row] = csv.split("\r\n");

    expect(row).toBe(
      "Hades,PLAYING,,,false,120,,,DIGITAL,Steam,2020-09-17,Roguelike,PC,2",
    );
  });

  it("builds a BOOKS CSV including page progress", async () => {
    const service = makeService("bookEntry", [
      {
        status: "READING",
        rating: 9,
        notes: null,
        favorite: false,
        currentPage: 120,
        startedAt: null,
        finishedAt: null,
        ownershipStatus: "NONE",
        ownershipSource: null,
        bookItem: {
          title: "Dune",
          authors: ["Frank Herbert"],
          releaseDate: new Date("1965-08-01T00:00:00.000Z"),
          pageCount: 412,
          genres: ["Sci-Fi"],
        },
        replays: [],
      },
    ]);

    const csv = await service.buildCsv("user-1", Domain.BOOKS);
    const [, row] = csv.split("\r\n");

    expect(row).toBe(
      "Dune,Frank Herbert,READING,9,,false,120,,,NONE,,1965-08-01,412,Sci-Fi,0",
    );
  });

  it("rejects a CSV export for the parked MUSIC domain", async () => {
    const service = makeService("musicEntry", [
      {
        status: "LISTENED",
        rating: 10,
        notes: null,
        favorite: true,
        startedAt: null,
        finishedAt: new Date("2026-02-01T00:00:00.000Z"),
        ownershipStatus: "NONE",
        ownershipSource: null,
        musicItem: {
          title: "Discovery",
          artists: ["Daft Punk"],
          releaseDate: new Date("2001-03-12T00:00:00.000Z"),
          genres: ["Electronic"],
        },
      },
    ]);

    await expect(service.buildCsv("user-1", Domain.MUSIC)).rejects.toEqual(
      expect.objectContaining({ code: ErrorCode.UserCsvExportUnavailable }),
    );
  });

  it("returns just the header row when the user has no entries", async () => {
    const service = makeService("libraryEntry", []);

    const csv = await service.buildCsv("user-1", Domain.MEDIA);

    expect(csv.split("\r\n")).toHaveLength(1);
  });
});
