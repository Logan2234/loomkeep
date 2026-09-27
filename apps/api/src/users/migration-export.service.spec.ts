import { vi, type Mock } from "vitest";
import { parseCsv } from "../import/csv";
import { parseGoodreadsCsv } from "../import/sources/books/goodreads-parse";
import type { PrismaService } from "../prisma/prisma.service";
import { MigrationExportService } from "./migration-export.service";

function makeService(data: {
  libraryEntries?: unknown[];
  bookEntries?: unknown[];
  reviews?: { targetId: string; rating: number; text: string | null }[];
  episodeWatches?: unknown[];
}) {
  const prisma = {
    libraryEntry: {
      findMany: vi.fn().mockResolvedValue(data.libraryEntries ?? []),
    },
    bookEntry: { findMany: vi.fn().mockResolvedValue(data.bookEntries ?? []) },
    review: { findMany: vi.fn().mockResolvedValue(data.reviews ?? []) },
    episodeWatch: {
      findMany: vi.fn().mockResolvedValue(data.episodeWatches ?? []),
    },
  } as unknown as PrismaService;
  return { service: new MigrationExportService(prisma), prisma };
}

function movieEntry(overrides: {
  id: string;
  status: string;
  finishedAt?: Date | null;
  replays?: Date[];
  type?: string;
}) {
  return {
    mediaItemId: overrides.id,
    status: overrides.status,
    notes: "private note, never exported",
    finishedAt: overrides.finishedAt ?? null,
    replays: (overrides.replays ?? []).map((finishedAt) => ({ finishedAt })),
    mediaItem: {
      id: overrides.id,
      type: overrides.type ?? "MOVIE",
      title: `Film ${overrides.id}`,
      releaseDate: new Date("2021-10-22T00:00:00.000Z"),
      externalIds:
        overrides.type === "ANIME"
          ? [{ source: "ANILIST", externalId: "999" }]
          : [
              { source: "TMDB", externalId: "438631" },
              { source: "IMDB", externalId: "tt1160419" },
            ],
    },
  };
}

function bookEntry(overrides: {
  id: string;
  status: string;
  isbn?: string | null;
  finishedAt?: Date | null;
  replays?: Date[];
}) {
  return {
    bookItemId: overrides.id,
    status: overrides.status,
    notes: "private note, never exported",
    finishedAt: overrides.finishedAt ?? null,
    createdAt: new Date("2025-03-04T10:00:00.000Z"),
    replays: (overrides.replays ?? []).map((finishedAt) => ({ finishedAt })),
    bookItem: {
      id: overrides.id,
      title: `Book ${overrides.id}`,
      authors: ["Ursula K. Le Guin", "Someone Else"],
      isbn: overrides.isbn ?? null,
      pageCount: 250,
      releaseDate: new Date("1969-03-01T00:00:00.000Z"),
    },
  };
}

describe("MigrationExportService.buildLetterboxd", () => {
  it("writes one diary row per viewing and planned films to the watchlist", async () => {
    const { service } = makeService({
      libraryEntries: [
        movieEntry({
          id: "m1",
          status: "COMPLETED",
          finishedAt: new Date("2024-01-10T21:00:00.000Z"),
          replays: [new Date("2025-06-01T20:00:00.000Z")],
        }),
        movieEntry({ id: "m2", status: "PLANNED" }),
      ],
      reviews: [{ targetId: "m1", rating: 7.5, text: "Great <3\nReally." }],
    });

    const files = await service.buildLetterboxd("u1", true);

    expect(files.map((f) => f.name)).toEqual([
      "letterboxd-diary",
      "letterboxd-watchlist",
    ]);
    expect(parseCsv(files[0].csv)).toEqual([
      {
        tmdbID: "438631",
        imdbID: "tt1160419",
        Title: "Film m1",
        Year: "2021",
        Rating10: "8",
        WatchedDate: "2024-01-10",
        Rewatch: "false",
        Review: "",
      },
      {
        tmdbID: "438631",
        imdbID: "tt1160419",
        Title: "Film m1",
        Year: "2021",
        Rating10: "8",
        WatchedDate: "2025-06-01",
        Rewatch: "true",
        Review: "Great &lt;3<br>Really.",
      },
    ]);
    expect(parseCsv(files[1].csv)).toEqual([
      {
        tmdbID: "438631",
        imdbID: "tt1160419",
        Title: "Film m2",
        Year: "2021",
      },
    ]);
  });

  it("leaves reviews and private notes out unless asked, and a 0 unrated", async () => {
    const { service } = makeService({
      libraryEntries: [movieEntry({ id: "m1", status: "COMPLETED" })],
      reviews: [{ targetId: "m1", rating: 0, text: "Some review" }],
    });

    const [diary] = await service.buildLetterboxd("u1", false);

    const [row] = parseCsv(diary.csv);
    expect(row.Rating10).toBe("");
    expect(row.Review).toBe("");
    expect(diary.csv).not.toContain("private note");
  });

  it("includes anime films, matched by title and year, one row per watch", async () => {
    const { service, prisma } = makeService({
      libraryEntries: [
        movieEntry({ id: "a1", status: "COMPLETED", type: "ANIME" }),
      ],
      episodeWatches: [
        {
          watchedAt: new Date("2023-02-01T12:00:00.000Z"),
          episode: { season: { mediaItemId: "a1" } },
        },
        {
          watchedAt: new Date("2024-02-01T12:00:00.000Z"),
          episode: { season: { mediaItemId: "a1" } },
        },
      ],
    });

    const [diary] = await service.buildLetterboxd("u1", false);

    const [query] = (prisma.libraryEntry.findMany as Mock).mock.calls[0];
    expect(query.where.mediaItem.OR).toContainEqual({
      type: "ANIME",
      format: "MOVIE",
    });
    expect(
      parseCsv(diary.csv).map((r) => [
        r.tmdbID,
        r.Title,
        r.WatchedDate,
        r.Rewatch,
      ]),
    ).toEqual([
      ["", "Film a1", "2023-02-01", "false"],
      ["", "Film a1", "2024-02-01", "true"],
    ]);
  });

  it("splits the diary into parts under Letterboxd's 1 MB cap", async () => {
    const entries = Array.from({ length: 700 }, (_, i) =>
      movieEntry({ id: `m${i}`, status: "COMPLETED" }),
    );
    const { service } = makeService({
      libraryEntries: entries,
      reviews: entries.map((e) => ({
        targetId: e.mediaItemId,
        rating: 8,
        text: "x".repeat(2000),
      })),
    });

    const files = await service.buildLetterboxd("u1", true);

    expect(files.map((f) => f.name)).toEqual([
      "letterboxd-diary",
      "letterboxd-diary-2",
    ]);

    for (const file of files) {
      expect(Buffer.byteLength(file.csv)).toBeLessThanOrEqual(1_000_000);
      expect(file.csv.startsWith("tmdbID,imdbID,Title")).toBe(true);
    }

    expect(files.flatMap((f) => parseCsv(f.csv))).toHaveLength(700);
  });

  it("returns no file when there is no film to export", async () => {
    const { service } = makeService({});

    expect(await service.buildLetterboxd("u1", true)).toEqual([]);
  });
});

describe("MigrationExportService.buildGoodreads", () => {
  it("round-trips through Loomkeep's own Goodreads import", async () => {
    const { service } = makeService({
      bookEntries: [
        bookEntry({
          id: "b1",
          status: "READ",
          isbn: "9780441478125",
          finishedAt: new Date("2020-05-01T00:00:00.000Z"),
          replays: [new Date("2024-08-15T00:00:00.000Z")],
        }),
        bookEntry({ id: "b2", status: "READING", isbn: "0441478123" }),
        bookEntry({ id: "b3", status: "TO_READ" }),
        bookEntry({ id: "b4", status: "DROPPED" }),
      ],
      reviews: [
        { targetId: "b1", rating: 7, text: "A classic." },
        { targetId: "b2", rating: 0, text: null },
      ],
    });

    const [file] = await service.buildGoodreads("u1", true);
    const rows = parseGoodreadsCsv(file.csv);

    expect(file.name).toBe("goodreads-library");
    expect(rows.map((r) => [r.title, r.status, r.isbn, r.rating])).toEqual([
      ["Book b1", "READ", "9780441478125", 8],
      ["Book b2", "READING", "0441478123", null],
      ["Book b3", "TO_READ", null, null],
      ["Book b4", "DROPPED", null, null],
    ]);
    expect(rows[0]).toMatchObject({
      authors: ["Ursula K. Le Guin", "Someone Else"],
      finishedAt: "2024-08-15T00:00:00.000Z",
      readCount: 2,
      notes: "A classic.",
    });
    expect(file.csv).not.toContain("private note");
  });

  it("leaves the review text out unless asked", async () => {
    const { service } = makeService({
      bookEntries: [bookEntry({ id: "b1", status: "READ" })],
      reviews: [{ targetId: "b1", rating: 9, text: "A classic." }],
    });

    const [file] = await service.buildGoodreads("u1", false);

    const [row] = parseCsv(file.csv);
    expect(row["My Rating"]).toBe("5");
    expect(row["My Review"]).toBe("");
  });
});
