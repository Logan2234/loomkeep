import { ProfileAccess } from "@loomkeep/shared";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service";
import type { FollowService } from "../follow.service";
import { LeaderboardService, periodRange } from "./leaderboard.service";

interface MockUser {
  id: string;
  username: string;
  displayName: string;
  avatarUpdatedAt: Date | null;
  profileAccess: ProfileAccess;
  createdAt: Date;
}

function makeUser(over: Partial<MockUser> & { id: string }): MockUser {
  return {
    username: over.id,
    displayName: over.id,
    avatarUpdatedAt: null,
    profileAccess: ProfileAccess.PUBLIC,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

function makeService(opts: {
  sums: { userId: string; _sum: { amount: number | null } }[];
  users: MockUser[];
  follows?: { followeeId: string }[];
  friendIds?: string[];
}) {
  const groupBy = vi.fn().mockResolvedValue(opts.sums);
  const findManyUser = vi.fn().mockResolvedValue(opts.users);
  const findManyFollow = vi.fn().mockResolvedValue(opts.follows ?? []);

  const prisma = {
    xpEntry: { groupBy },
    user: { findMany: findManyUser },
    follow: { findMany: findManyFollow },
  } as unknown as PrismaService;

  const follow = {
    listFriendIds: vi.fn().mockResolvedValue(opts.friendIds ?? []),
  } as unknown as FollowService;

  return {
    service: new LeaderboardService(prisma, follow),
    groupBy,
    findManyUser,
    findManyFollow,
    follow,
  };
}

describe("LeaderboardService.getLeaderboard", () => {
  it("shares a rank across a tie and skips ahead by the tie's size for the next distinct value", async () => {
    const users = [
      makeUser({ id: "a", createdAt: new Date("2026-01-01") }),
      makeUser({ id: "b", createdAt: new Date("2026-02-01") }),
      makeUser({ id: "c", createdAt: new Date("2026-03-01") }),
      makeUser({ id: "d", createdAt: new Date("2026-04-01") }),
    ];
    const { service } = makeService({
      sums: [
        { userId: "a", _sum: { amount: 100 } },
        { userId: "b", _sum: { amount: 90 } },
        { userId: "c", _sum: { amount: 90 } },
        { userId: "d", _sum: { amount: 80 } },
      ],
      users,
    });

    const { entries } = await service.getLeaderboard(
      "nobody",
      "global",
      "month",
    );
    const rankOf = (id: string) => entries.find((e) => e.id === id)?.rank;

    expect(rankOf("a")).toBe(1);
    expect(rankOf("b")).toBe(2);
    expect(rankOf("c")).toBe(2);
    expect(rankOf("d")).toBe(4);
  });

  it("puts the viewer's row in viewerOutsideTop only past the Top 100 cutoff, not in entries", async () => {
    const users = Array.from({ length: 101 }, (_, i) =>
      makeUser({ id: `u${i}` }),
    );
    const sums = users.map((u, i) => ({
      userId: u.id,
      // 101 distinct values, strictly descending, so every row gets its own rank.
      _sum: { amount: 1000 - i },
    }));
    const viewerId = "u100"; // last row: rank 101, outside the Top 100.

    const { service } = makeService({ sums, users });
    const result = await service.getLeaderboard(viewerId, "global", "month");

    expect(result.entries).toHaveLength(100);
    expect(result.entries.some((e) => e.id === viewerId)).toBe(false);
    expect(result.viewerOutsideTop?.id).toBe(viewerId);
    expect(result.viewerOutsideTop?.rank).toBe(101);
    expect(result.viewerOutsideTop?.isViewer).toBe(true);
  });

  it("returns an empty board (not an error) when nobody has XP this period", async () => {
    const { service } = makeService({ sums: [], users: [] });
    const result = await service.getLeaderboard("viewer", "global", "month");
    expect(result).toEqual({ entries: [], viewerOutsideTop: null });
  });

  it("masks a PRIVATE row's avatar unless the viewer follows them, regardless of what they uploaded", async () => {
    const users = [
      makeUser({
        id: "stranger",
        profileAccess: ProfileAccess.PRIVATE,
        avatarUpdatedAt: new Date("2026-01-01"),
      }),
      makeUser({
        id: "friend",
        profileAccess: ProfileAccess.PRIVATE,
        avatarUpdatedAt: new Date("2026-01-01"),
      }),
      makeUser({
        id: "public-user",
        profileAccess: ProfileAccess.PUBLIC,
        avatarUpdatedAt: new Date("2026-01-01"),
      }),
    ];
    const { service, findManyFollow } = makeService({
      sums: [
        { userId: "stranger", _sum: { amount: 300 } },
        { userId: "friend", _sum: { amount: 200 } },
        { userId: "public-user", _sum: { amount: 100 } },
      ],
      users,
      follows: [{ followeeId: "friend" }],
    });

    const { entries } = await service.getLeaderboard(
      "viewer",
      "global",
      "month",
    );
    const byId = (id: string) => entries.find((e) => e.id === id)!;

    expect(byId("stranger").avatarUrl).toBeNull();
    expect(byId("friend").avatarUrl).not.toBeNull();
    expect(byId("public-user").avatarUrl).not.toBeNull();
    // Only the PRIVATE rows are ever checked against Follow — never the
    // viewer's own or an already-public row.
    expect(findManyFollow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          followeeId: { in: expect.arrayContaining(["stranger", "friend"]) },
        }),
      }),
    );
  });

  it("excludes GHOST and hideProgression accounts from the query itself", async () => {
    const { service, groupBy } = makeService({ sums: [], users: [] });
    await service.getLeaderboard("viewer", "global", "month");

    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: {
            profileAccess: { not: ProfileAccess.GHOST },
            hideProgression: false,
          },
        }),
      }),
    );
  });

  it("scopes the friends leaderboard to the viewer plus their friend ids", async () => {
    const { service, groupBy, follow } = makeService({
      sums: [],
      users: [],
      friendIds: ["friend-1", "friend-2"],
    });

    await service.getLeaderboard("viewer", "friends", "year");

    expect(follow.listFriendIds).toHaveBeenCalledWith("viewer");
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { in: ["viewer", "friend-1", "friend-2"] },
        }),
      }),
    );
  });
});

describe("periodRange", () => {
  it("bounds a calendar month, exclusive of the next month's first instant", () => {
    const { start, end } = periodRange(
      "month",
      new Date("2026-02-15T10:00:00Z"),
    );
    expect(start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("rolls a December month over into January of the next year", () => {
    const { start, end } = periodRange(
      "month",
      new Date("2026-12-15T10:00:00Z"),
    );
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("bounds a calendar year", () => {
    const { start, end } = periodRange(
      "year",
      new Date("2026-07-01T00:00:00Z"),
    );
    expect(start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
