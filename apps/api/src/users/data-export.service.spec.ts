import { NotFoundException } from "@nestjs/common";
import type { User } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { DataExportService } from "./data-export.service";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "alice@example.com",
    username: "alice",
    displayName: "Alice",
    passwordHash: "irrelevant",
    birthDate: null,
    allowAdultContent: false,
    notifyEmail: true,
    notifyPush: true,
    emailVerified: false,
    entitlements: [],
    role: "USER",
    enabledDomains: ["MEDIA", "BOOKS", "GAMES", "MUSIC"],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as User;
}

function makeService() {
  const prisma = {
    user: { findUnique: jest.fn() },
    libraryEntry: { findMany: jest.fn().mockResolvedValue([]) },
    episodeWatch: { findMany: jest.fn().mockResolvedValue([]) },
    gameEntry: { findMany: jest.fn().mockResolvedValue([]) },
    bookEntry: { findMany: jest.fn().mockResolvedValue([]) },
    musicEntry: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  // Ratings live in Review now; the export projects them but these tests don't
  // assert the value, so an empty projection is enough.
  const reviews = {
    getRatings: jest.fn(() => Promise.resolve(new Map())),
  } as unknown as import("../reviews/review.service").ReviewService;

  return { service: new DataExportService(prisma, reviews), prisma };
}

describe("DataExportService.buildExport", () => {
  it("throws NotFoundException when the account doesn't exist", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.buildExport("nobody")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("includes the game library, its external id and its replays", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(makeUser());
    (prisma.gameEntry.findMany as jest.Mock).mockResolvedValue([
      {
        status: "PLAYING",
        rating: 8,
        notes: null,
        favorite: true,
        playtimeMinutes: 120,
        ownershipStatus: "DIGITAL",
        ownershipSource: "Steam",
        startedAt: new Date("2026-02-01T00:00:00.000Z"),
        finishedAt: null,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        gameItem: {
          title: "Hades",
          canonicalSource: "IGDB",
          externalIds: [{ source: "IGDB", externalId: "1234" }],
        },
        replays: [{ finishedAt: new Date("2026-03-01T00:00:00.000Z") }],
      },
    ]);

    const result = await service.buildExport("user-1");

    expect(result.games).toEqual([
      expect.objectContaining({
        game: expect.objectContaining({ title: "Hades", sourceId: "1234" }),
        playtimeMinutes: 120,
        replays: ["2026-03-01T00:00:00.000Z"],
      }),
    ]);
  });

  it("includes the book library", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(makeUser());
    (prisma.bookEntry.findMany as jest.Mock).mockResolvedValue([
      {
        status: "READ",
        rating: 9,
        notes: "great",
        favorite: false,
        currentPage: 320,
        ownershipStatus: "PHYSICAL",
        ownershipSource: null,
        startedAt: null,
        finishedAt: new Date("2026-02-10T00:00:00.000Z"),
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        bookItem: {
          title: "Dune",
          authors: ["Frank Herbert"],
          canonicalSource: "GOOGLE_BOOKS",
          externalIds: [{ source: "GOOGLE_BOOKS", externalId: "abc" }],
        },
        replays: [],
      },
    ]);

    const result = await service.buildExport("user-1");

    expect(result.books).toEqual([
      expect.objectContaining({
        book: expect.objectContaining({
          title: "Dune",
          authors: ["Frank Herbert"],
          sourceId: "abc",
        }),
        currentPage: 320,
      }),
    ]);
  });

  it("includes the music library and its external id", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(makeUser());
    (prisma.musicEntry.findMany as jest.Mock).mockResolvedValue([
      {
        status: "LISTENED",
        rating: 9,
        notes: null,
        favorite: true,
        ownershipStatus: "PHYSICAL",
        ownershipSource: null,
        startedAt: null,
        finishedAt: new Date("2026-02-10T00:00:00.000Z"),
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        musicItem: {
          title: "Discovery",
          artists: ["Daft Punk"],
          canonicalSource: "MUSICBRAINZ",
          externalIds: [{ source: "MUSICBRAINZ", externalId: "mbid-1" }],
        },
      },
    ]);

    const result = await service.buildExport("user-1");

    expect(result.music).toEqual([
      expect.objectContaining({
        album: expect.objectContaining({
          title: "Discovery",
          artists: ["Daft Punk"],
          sourceId: "mbid-1",
        }),
        status: "LISTENED",
      }),
    ]);
  });

  it("includes notifications", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(makeUser());
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([
      {
        type: "NEW_EPISODE",
        title: "Show",
        body: "S1E2 · Pilot",
        url: "/media/series/42",
        data: { airDate: "2026-01-05T00:00:00.000Z" },
        readAt: null,
        createdAt: new Date("2026-01-06T00:00:00.000Z"),
      },
    ]);

    const result = await service.buildExport("user-1");

    expect(result.notifications).toEqual([
      expect.objectContaining({ title: "Show", body: "S1E2 · Pilot" }),
    ]);
  });
});
