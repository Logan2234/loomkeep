import type { User } from "@prisma/client";
import { vi, type Mock } from "vitest";
import { AppException } from "../common/app.exception";
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
    role: "USER",
    enabledDomains: ["MEDIA", "BOOKS", "GAMES", "MUSIC"],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as User;
}

function makeService() {
  const prisma = {
    user: { findUnique: vi.fn() },
    libraryEntry: { findMany: vi.fn().mockResolvedValue([]) },
    episodeWatch: { findMany: vi.fn().mockResolvedValue([]) },
    gameEntry: { findMany: vi.fn().mockResolvedValue([]) },
    bookEntry: { findMany: vi.fn().mockResolvedValue([]) },
    musicEntry: { findMany: vi.fn().mockResolvedValue([]) },
    notification: { findMany: vi.fn().mockResolvedValue([]) },
    review: { findMany: vi.fn().mockResolvedValue([]) },
    reviewVote: { findMany: vi.fn().mockResolvedValue([]) },
    comment: { findMany: vi.fn().mockResolvedValue([]) },
    commentReaction: { findMany: vi.fn().mockResolvedValue([]) },
    list: { findMany: vi.fn().mockResolvedValue([]) },
    listMember: { findMany: vi.fn().mockResolvedValue([]) },
    follow: { findMany: vi.fn().mockResolvedValue([]) },
    block: { findMany: vi.fn().mockResolvedValue([]) },
    report: { findMany: vi.fn().mockResolvedValue([]) },
    moderationDecision: { findMany: vi.fn().mockResolvedValue([]) },
    securityEvent: { findMany: vi.fn().mockResolvedValue([]) },
    userDevice: { findMany: vi.fn().mockResolvedValue([]) },
    visibilitySetting: { findMany: vi.fn().mockResolvedValue([]) },
    userEntitlement: {
      upsert: vi.fn().mockResolvedValue({
        userId: "user-1",
        plan: "FREE",
        source: null,
        grantedAt: null,
        expiresAt: null,
        overrides: {},
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    },
    subscription: { findMany: vi.fn().mockResolvedValue([]) },
    readingGoal: { findMany: vi.fn().mockResolvedValue([]) },
    importRun: { findMany: vi.fn().mockResolvedValue([]) },
    mediaItem: { findMany: vi.fn().mockResolvedValue([]) },
    gameItem: { findMany: vi.fn().mockResolvedValue([]) },
    bookItem: { findMany: vi.fn().mockResolvedValue([]) },
    musicItem: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  // Ratings live in Review now; the export projects them but these tests don't
  // assert the value, so an empty projection is enough.
  const reviews = {
    getRatings: vi.fn(() => Promise.resolve(new Map())),
  } as unknown as import("../reviews/review.service").ReviewService;

  return { service: new DataExportService(prisma, reviews), prisma };
}

describe("DataExportService.buildExport", () => {
  it("throws AppException when the account doesn't exist", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue(null);

    await expect(service.buildExport("nobody")).rejects.toThrow(AppException);
  });

  it("includes the game library, its external id and its replays", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue(makeUser());
    (prisma.gameEntry.findMany as Mock).mockResolvedValue([
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
    (prisma.user.findUnique as Mock).mockResolvedValue(makeUser());
    (prisma.bookEntry.findMany as Mock).mockResolvedValue([
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
          canonicalSource: "OPEN_LIBRARY",
          externalIds: [{ source: "OPEN_LIBRARY", externalId: "OL1W" }],
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
          sourceId: "OL1W",
        }),
        currentPage: 320,
      }),
    ]);
  });

  it("includes the music library and its external id", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue(makeUser());
    (prisma.musicEntry.findMany as Mock).mockResolvedValue([
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
    (prisma.user.findUnique as Mock).mockResolvedValue(makeUser());
    (prisma.notification.findMany as Mock).mockResolvedValue([
      {
        type: "NEW_EPISODE",
        title: "Show",
        body: "S1E2 · Pilot",
        url: "/media/series/42",
        data: { airDate: "2026-01-05T00:00:00.000Z" },
        createdAt: new Date("2026-01-06T00:00:00.000Z"),
      },
    ]);

    const result = await service.buildExport("user-1");

    expect(result.notifications).toEqual([
      expect.objectContaining({ title: "Show", body: "S1E2 · Pilot" }),
    ]);
  });

  it("includes review text and its edit history, with the target title resolved", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue(makeUser());
    (prisma.review.findMany as Mock).mockResolvedValue([
      {
        targetType: "MEDIA",
        targetId: "media-1",
        rating: 8,
        text: "Great show",
        visibility: "FRIENDS",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        revisions: [
          {
            rating: 7,
            text: "Good show",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
      },
    ]);
    (prisma.mediaItem.findMany as Mock).mockResolvedValue([
      { id: "media-1", title: "Severance" },
    ]);

    const result = await service.buildExport("user-1");

    expect(result.reviews).toEqual([
      expect.objectContaining({
        targetTitle: "Severance",
        text: "Great show",
        revisions: [expect.objectContaining({ text: "Good show" })],
      }),
    ]);
  });

  it("includes comments, lists, follows and a default FREE entitlement", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue(makeUser());
    (prisma.comment.findMany as Mock).mockResolvedValue([
      {
        targetType: "MEDIA",
        targetId: "media-1",
        parentId: null,
        text: "Nice one",
        spoilerTag: false,
        edited: false,
        deletedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    (prisma.list.findMany as Mock).mockResolvedValue([
      {
        title: "Top 10",
        description: null,
        kind: "RANKED",
        visibility: "PRIVATE",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        items: [],
      },
    ]);
    (prisma.follow.findMany as Mock).mockResolvedValueOnce([
      {
        followee: { username: "bob" },
        status: "ACCEPTED",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const result = await service.buildExport("user-1");

    expect(result.comments).toEqual([
      expect.objectContaining({ text: "Nice one" }),
    ]);
    expect(result.lists).toEqual([
      expect.objectContaining({ title: "Top 10" }),
    ]);
    expect(result.follows.following).toEqual([
      expect.objectContaining({ username: "bob" }),
    ]);
    expect(result.entitlement).toEqual(
      expect.objectContaining({ plan: "FREE" }),
    );
  });
});
