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
    savedView: { findMany: vi.fn().mockResolvedValue([]) },
    mediaItem: { findMany: vi.fn().mockResolvedValue([]) },
    gameItem: { findMany: vi.fn().mockResolvedValue([]) },
    bookItem: { findMany: vi.fn().mockResolvedValue([]) },
    musicItem: { findMany: vi.fn().mockResolvedValue([]) },
    activityEvent: { findMany: vi.fn().mockResolvedValue([]) },
    xpEntry: { findMany: vi.fn().mockResolvedValue([]) },
    userScore: { findUnique: vi.fn().mockResolvedValue(null) },
    userAchievement: { findMany: vi.fn().mockResolvedValue([]) },
    apiKey: { findMany: vi.fn().mockResolvedValue([]) },
    webauthnCredential: { findMany: vi.fn().mockResolvedValue([]) },
    pushSubscription: { findMany: vi.fn().mockResolvedValue([]) },
    sessionTimer: { findUnique: vi.fn().mockResolvedValue(null) },
    refreshToken: { findMany: vi.fn().mockResolvedValue([]) },
    emailChangeRequest: { findFirst: vi.fn().mockResolvedValue(null) },
    invitation: { findFirst: vi.fn().mockResolvedValue(null) },
    listItem: { findMany: vi.fn().mockResolvedValue([]) },
    listNotificationMute: { findMany: vi.fn().mockResolvedValue([]) },
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
        trackedPlaytimeMinutes: 0,
        steamPlaytimeMinutes: 120,
        steamSyncedAt: new Date("2026-02-02T00:00:00.000Z"),
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
        playthroughs: [
          {
            number: 2,
            status: "COMPLETED",
            startedAt: null,
            finishedAt: new Date("2026-03-01T00:00:00.000Z"),
            trackedMinutes: 0,
          },
        ],
        sessions: [
          {
            durationMinutes: 45,
            notes: "Beat Meg",
            occurredAt: new Date("2026-02-03T00:00:00.000Z"),
            source: "MANUAL",
            createdAt: new Date("2026-02-03T00:00:00.000Z"),
            playthrough: { number: 1 },
          },
        ],
      },
    ]);

    const result = await service.buildExport("user-1");

    expect(result.games).toEqual([
      expect.objectContaining({
        game: expect.objectContaining({ title: "Hades", sourceId: "1234" }),
        playtimeMinutes: 120,
        replays: ["2026-03-01T00:00:00.000Z"],
        sessions: [expect.objectContaining({ notes: "Beat Meg" })],
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
        editionKey: "OL1M",
        referencePageCount: 320,
        trackedReadingMinutes: 0,
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
        readings: [],
        sessions: [
          {
            durationMinutes: 30,
            pagesRead: 25,
            startPage: null,
            endPage: null,
            notes: "The spice must flow",
            occurredAt: new Date("2026-02-05T00:00:00.000Z"),
            source: "MANUAL",
            createdAt: new Date("2026-02-05T00:00:00.000Z"),
            reading: { number: 1 },
          },
        ],
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
        sessions: [expect.objectContaining({ notes: "The spice must flow" })],
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

  it("includes saved library views, by the id home widgets refer to", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue(makeUser());
    (prisma.savedView.findMany as Mock).mockResolvedValue([
      {
        id: "view-1",
        userId: "user-1",
        name: "Backlog Switch",
        domain: "GAMES",
        filters: { statuses: ["BACKLOG"], sort: "added" },
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-02T00:00:00.000Z"),
      },
    ]);

    const result = await service.buildExport("user-1");

    expect(result.savedViews).toEqual([
      {
        id: "view-1",
        name: "Backlog Switch",
        domain: "GAMES",
        filters: { statuses: ["BACKLOG"], sort: "added" },
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
      },
    ]);
  });

  it("leaves nothing out: rewatches, consents, photo, activity, progression and sign-in methods", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue(
      makeUser({
        acceptedTermsAt: new Date("2026-01-01T00:00:00.000Z"),
        certifiedAgeAt: new Date("2026-01-01T00:00:00.000Z"),
        avatar: Buffer.from("png-bytes"),
        avatarMimeType: "image/png",
        equippedBadgeKeys: ["first_review"],
      }),
    );
    (prisma.libraryEntry.findMany as Mock).mockResolvedValue([
      {
        mediaItem: {
          type: "MOVIE",
          title: "Dune",
          canonicalSource: "TMDB",
          externalIds: [{ source: "TMDB", externalId: "438631" }],
        },
        status: "COMPLETED",
        notes: null,
        favorite: false,
        startedAt: null,
        finishedAt: null,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        replays: [{ finishedAt: new Date("2026-03-01T20:00:00.000Z") }],
      },
    ]);
    (prisma.activityEvent.findMany as Mock).mockResolvedValue([
      {
        type: "COMPLETED",
        domain: "MEDIA",
        title: "Dune",
        href: "/app/media/movie/438631",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    ]);
    (prisma.userScore.findUnique as Mock).mockResolvedValue({ xp: 120 });
    (prisma.xpEntry.findMany as Mock).mockResolvedValue([
      {
        reason: "REVIEW",
        amount: 20,
        createdAt: new Date("2026-02-02T00:00:00.000Z"),
      },
    ]);
    (prisma.userAchievement.findMany as Mock).mockResolvedValue([
      { key: "first_review", unlockedAt: new Date("2026-02-02T00:00:00.000Z") },
    ]);
    (prisma.apiKey.findMany as Mock).mockResolvedValue([
      {
        name: "Script",
        suffix: "a1b2",
        scopes: ["library:read"],
        tokenHash: "secret-hash",
        createdAt: new Date("2026-02-03T00:00:00.000Z"),
        lastUsedAt: null,
        expiresAt: null,
      },
    ]);
    (prisma.webauthnCredential.findMany as Mock).mockResolvedValue([
      {
        name: "iPhone",
        deviceType: "multiDevice",
        publicKey: Buffer.from("key"),
        createdAt: new Date("2026-02-04T00:00:00.000Z"),
        lastUsedAt: null,
      },
    ]);

    const data = await service.buildExport("user-1");

    expect(data.library[0].replays).toEqual(["2026-03-01T20:00:00.000Z"]);
    expect(data.accountRecord).toMatchObject({
      termsAcceptedAt: "2026-01-01T00:00:00.000Z",
      ageCertifiedAt: "2026-01-01T00:00:00.000Z",
      equippedBadgeKeys: ["first_review"],
      avatar: {
        mimeType: "image/png",
        base64: Buffer.from("png-bytes").toString("base64"),
      },
    });
    expect(data.activity).toEqual([
      {
        type: "COMPLETED",
        domain: "MEDIA",
        title: "Dune",
        href: "/app/media/movie/438631",
        createdAt: "2026-02-01T00:00:00.000Z",
      },
    ]);
    expect(data.progression).toEqual({
      xp: 120,
      xpEntries: [
        {
          reason: "REVIEW",
          amount: 20,
          createdAt: "2026-02-02T00:00:00.000Z",
          revokedAt: null,
        },
      ],
      achievements: [
        { key: "first_review", unlockedAt: "2026-02-02T00:00:00.000Z" },
      ],
    });
    // Secrets stay out: the key's hash, the passkey's public key.
    expect(data.apiKeys).toEqual([
      {
        name: "Script",
        suffix: "a1b2",
        scopes: ["library:read"],
        createdAt: "2026-02-03T00:00:00.000Z",
        lastUsedAt: null,
        expiresAt: null,
      },
    ]);
    expect(data.passkeys).toEqual([
      {
        name: "iPhone",
        deviceType: "multiDevice",
        createdAt: "2026-02-04T00:00:00.000Z",
        lastUsedAt: null,
      },
    ]);
    expect(JSON.stringify(data)).not.toContain("secret-hash");
    expect(JSON.stringify(data)).not.toContain("irrelevant");
  });

  it("exports every cycle, sessions, pending changes and what was added to other lists", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue(makeUser());
    (prisma.gameEntry.findMany as Mock).mockResolvedValue([
      {
        gameItemId: "g1",
        gameItem: {
          title: "Hades",
          canonicalSource: "IGDB",
          externalIds: [{ source: "IGDB", externalId: "113112" }],
        },
        status: "PLAYING",
        notes: null,
        favorite: false,
        platform: null,
        ownershipStatus: null,
        startedAt: null,
        finishedAt: null,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        playthroughs: [
          {
            number: 1,
            status: "COMPLETED",
            startedAt: new Date("2026-02-01T00:00:00.000Z"),
            finishedAt: new Date("2026-03-01T00:00:00.000Z"),
            trackedMinutes: 600,
          },
          {
            number: 2,
            status: "IN_PROGRESS",
            startedAt: new Date("2026-04-01T00:00:00.000Z"),
            finishedAt: null,
            trackedMinutes: 90,
          },
        ],
        sessions: [],
      },
    ]);
    (prisma.bookEntry.findMany as Mock).mockResolvedValue([
      {
        bookItemId: "b1",
        bookItem: {
          title: "Dune",
          canonicalSource: "OPEN_LIBRARY",
          externalIds: [{ source: "OPEN_LIBRARY", externalId: "OL1W" }],
        },
        status: "READING",
        notes: null,
        favorite: false,
        startedAt: null,
        finishedAt: null,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        readings: [
          {
            number: 1,
            status: "IN_PROGRESS",
            editionKey: "OL2M",
            referencePageCount: 600,
            currentPage: 212,
            pagesRead: 212,
            trackedMinutes: 300,
            startedAt: new Date("2026-02-01T00:00:00.000Z"),
            finishedAt: null,
          },
        ],
        sessions: [],
      },
    ]);
    (prisma.listItem.findMany as Mock).mockResolvedValue([
      {
        targetType: "MEDIA",
        targetId: "m1",
        addedAt: new Date("2026-05-01T00:00:00.000Z"),
        list: { title: "À voir ensemble", user: { username: "camille" } },
      },
    ]);
    (prisma.sessionTimer.findUnique as Mock).mockResolvedValue({
      domain: "GAMES",
      startedAt: new Date("2026-10-03T20:00:00.000Z"),
      pausedAt: null,
      accumulatedSeconds: 1200,
      gameEntry: { gameItem: { title: "Hades" } },
      bookEntry: null,
    });
    (prisma.refreshToken.findMany as Mock).mockResolvedValue([
      {
        userAgent: "Firefox",
        tokenHash: "secret-hash",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        lastUsedAt: new Date("2026-10-03T00:00:00.000Z"),
        expiresAt: new Date("2026-11-01T00:00:00.000Z"),
      },
    ]);
    (prisma.emailChangeRequest.findFirst as Mock).mockResolvedValue({
      newEmail: "alice@new.example",
      expiresAt: new Date("2026-10-04T00:00:00.000Z"),
    });
    (prisma.invitation.findFirst as Mock).mockResolvedValue({
      label: "Club ciné",
      createdBy: { displayName: "Logan" },
    });
    (prisma.listNotificationMute.findMany as Mock).mockResolvedValue([
      {
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        list: { title: "À voir ensemble" },
      },
    ]);

    const data = await service.buildExport("user-1");

    expect(data.games[0].playthroughs).toEqual([
      {
        number: 1,
        status: "COMPLETED",
        startedAt: "2026-02-01T00:00:00.000Z",
        finishedAt: "2026-03-01T00:00:00.000Z",
        trackedMinutes: 600,
      },
      {
        number: 2,
        status: "IN_PROGRESS",
        startedAt: "2026-04-01T00:00:00.000Z",
        finishedAt: null,
        trackedMinutes: 90,
      },
    ]);
    // `replays` keeps its meaning: completed cycles beyond the first.
    expect(data.games[0].replays).toEqual([]);
    expect(data.books[0].readings).toEqual([
      {
        number: 1,
        status: "IN_PROGRESS",
        editionKey: "OL2M",
        referencePageCount: 600,
        currentPage: 212,
        pagesRead: 212,
        trackedMinutes: 300,
        startedAt: "2026-02-01T00:00:00.000Z",
        finishedAt: null,
      },
    ]);
    expect(data.listItemsAdded).toEqual([
      {
        listTitle: "À voir ensemble",
        listOwnerUsername: "camille",
        targetType: "MEDIA",
        targetId: "m1",
        addedAt: "2026-05-01T00:00:00.000Z",
      },
    ]);
    expect(data.sessionTimer).toEqual({
      domain: "GAMES",
      title: "Hades",
      startedAt: "2026-10-03T20:00:00.000Z",
      pausedAt: null,
      accumulatedSeconds: 1200,
    });
    expect(data.sessions).toEqual([
      {
        userAgent: "Firefox",
        createdAt: "2026-09-01T00:00:00.000Z",
        lastUsedAt: "2026-10-03T00:00:00.000Z",
        expiresAt: "2026-11-01T00:00:00.000Z",
      },
    ]);
    expect(data.accountRecord.pendingEmailChange).toEqual({
      newEmail: "alice@new.example",
      expiresAt: "2026-10-04T00:00:00.000Z",
    });
    expect(data.accountRecord.invitation).toEqual({
      label: "Club ciné",
      invitedBy: "Logan",
    });
    expect(data.listMutes).toEqual([
      { listTitle: "À voir ensemble", mutedAt: "2026-06-01T00:00:00.000Z" },
    ]);
    expect(JSON.stringify(data)).not.toContain("secret-hash");
  });
});
