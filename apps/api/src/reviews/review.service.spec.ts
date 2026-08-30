import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { ActivityService } from "../social/activity.service";
import type { VisibilityService } from "../social/visibility.service";
import type { ViewerRelation } from "../social/visibility.util";
import { ReviewService } from "./review.service";

const VIEWER = "viewer";

function review(
  id: string,
  author: { id: string; profileAccess: string },
  visibility: string,
) {
  return {
    id,
    targetType: "MEDIA",
    targetId: "m1",
    rating: 8,
    text: null,
    visibility,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: author.id,
      username: author.id,
      displayName: author.id,
      profileAccess: author.profileAccess,
    },
  };
}

function relation(over: Partial<ViewerRelation>): ViewerRelation {
  return {
    isSelf: false,
    following: false,
    requested: false,
    followsYou: false,
    isFriend: false,
    blocking: false,
    blockedByTarget: false,
    ...over,
  };
}

function make(rows: unknown[], relations: Record<string, ViewerRelation>) {
  const prisma = {
    review: { findMany: vi.fn().mockResolvedValue(rows) },
    reviewVote: {
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    episodeWatch: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const visibility = {
    getRelation: vi.fn((_v: string, target: { id: string }) =>
      Promise.resolve(relations[target.id] ?? relation({})),
    ),
  } as unknown as VisibilityService;
  const activity = { emit: vi.fn() } as unknown as ActivityService;
  return new ReviewService(prisma, visibility, activity);
}

describe("ReviewService.listForTarget", () => {
  it("always includes the viewer's own review", async () => {
    const svc = make(
      [review("r", { id: VIEWER, profileAccess: "PRIVATE" }, "FRIENDS")],
      {},
    );
    const out = await svc.listForTarget(VIEWER, "MEDIA" as never, "m1");
    expect(out.map((r) => r.id)).toEqual(["r"]);
  });

  it("shows a GHOST author's review under their derived pseudonym", async () => {
    const svc = make(
      [review("r", { id: "ghost", profileAccess: "GHOST" }, "FRIENDS")],
      {},
    );
    const out = await svc.listForTarget(VIEWER, "MEDIA" as never, "m1");
    expect(out).toHaveLength(1);
    expect(out[0].author!.anonymized).toBe(true);
    expect(out[0].author!.username).toBe("");
    expect(out[0].author!.displayName).toMatch(/^Figurant n°\d{6}$/u);
  });

  it("still hides a GHOST author's review from someone they blocked", async () => {
    const svc = make(
      [review("r", { id: "ghost", profileAccess: "GHOST" }, "PUBLIC")],
      { ghost: relation({ blockedByTarget: true }) },
    );
    expect(
      await svc.listForTarget(VIEWER, "MEDIA" as never, "m1"),
    ).toHaveLength(0);
  });

  it("shows a PUBLIC review only when the author's profile is public", async () => {
    const rows = [
      review("pub", { id: "a", profileAccess: "PUBLIC" }, "PUBLIC"),
      review("priv", { id: "b", profileAccess: "PRIVATE" }, "PUBLIC"),
    ];
    const svc = make(rows, {
      a: relation({}),
      b: relation({ following: true }),
    });
    const out = await svc.listForTarget(VIEWER, "MEDIA" as never, "m1");
    expect(out.map((r) => r.id)).toEqual(["pub"]);
  });

  it("shows a FRIENDS review only to a friend", async () => {
    const rows = [review("r", { id: "a", profileAccess: "PUBLIC" }, "FRIENDS")];
    const stranger = make(rows, { a: relation({ following: true }) }); // not mutual
    expect(
      await stranger.listForTarget(VIEWER, "MEDIA" as never, "m1"),
    ).toHaveLength(0);
    const friend = make(rows, {
      a: relation({ following: true, followsYou: true, isFriend: true }),
    });
    expect(
      await friend.listForTarget(VIEWER, "MEDIA" as never, "m1"),
    ).toHaveLength(1);
  });

  it("omits reviews when either side blocks", async () => {
    const rows = [review("r", { id: "a", profileAccess: "PUBLIC" }, "PUBLIC")];
    const svc = make(rows, { a: relation({ blockedByTarget: true }) });
    expect(
      await svc.listForTarget(VIEWER, "MEDIA" as never, "m1"),
    ).toHaveLength(0);
  });
});

function makeForWrite(
  existing: { rating: number; text: string | null } | null,
) {
  const row = {
    id: "r1",
    rating: 8,
    text: null,
    visibility: "FRIENDS",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const revisionCreate = vi.fn().mockResolvedValue({});
  const prisma = {
    review: {
      findUnique: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue(row),
      create: vi.fn().mockResolvedValue(row),
    },
    reviewRevision: { create: revisionCreate },
    reviewVote: {
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ defaultReviewVisibility: "FRIENDS" }),
    },
    episodeWatch: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const activity = { emit: vi.fn() } as unknown as ActivityService;
  const visibility = {} as unknown as VisibilityService;
  const svc = new ReviewService(prisma, visibility, activity);
  return { svc, revisionCreate };
}

describe("ReviewService.upsert — revision snapshotting", () => {
  it("creates a revision when the review is new", async () => {
    const { svc, revisionCreate } = makeForWrite(null);
    await svc.upsert("u1", "MEDIA" as never, "m1", { rating: 8, text: null });
    expect(revisionCreate).toHaveBeenCalledTimes(1);
  });

  it("creates a revision when rating or text changed", async () => {
    const { svc, revisionCreate } = makeForWrite({ rating: 6, text: null });
    await svc.upsert("u1", "MEDIA" as never, "m1", { rating: 8, text: null });
    expect(revisionCreate).toHaveBeenCalledTimes(1);
  });

  it("skips the revision when nothing changed", async () => {
    const { svc, revisionCreate } = makeForWrite({ rating: 8, text: null });
    await svc.upsert("u1", "MEDIA" as never, "m1", {
      rating: 8,
      text: null,
      visibility: "PUBLIC",
    });
    expect(revisionCreate).not.toHaveBeenCalled();
  });

  it("skips the revision when only the visibility changed", async () => {
    const { svc, revisionCreate } = makeForWrite({ rating: 8, text: "hey" });
    await svc.upsert("u1", "MEDIA" as never, "m1", {
      rating: 8,
      text: "hey",
      visibility: "PUBLIC",
    });
    expect(revisionCreate).not.toHaveBeenCalled();
  });
});

function makeForVoting(opts: {
  reviewOwnerId: string;
  grouped?: { reviewId: string; value: string; _count: { _all: number } }[];
}) {
  const upsert = vi.fn().mockResolvedValue({});
  const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
  const prisma = {
    review: {
      findUnique: vi.fn().mockResolvedValue({ userId: opts.reviewOwnerId }),
    },
    reviewVote: {
      upsert,
      deleteMany,
      groupBy: vi.fn().mockResolvedValue(opts.grouped ?? []),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;
  const svc = new ReviewService(
    prisma,
    {} as unknown as VisibilityService,
    {} as unknown as ActivityService,
  );
  return { svc, upsert, deleteMany };
}

describe("ReviewService.vote", () => {
  it("rejects voting on your own review", async () => {
    const { svc } = makeForVoting({ reviewOwnerId: "author" });
    await expect(svc.vote("author", "r1", "UP" as never)).rejects.toThrow(
      "You cannot vote on your own review",
    );
  });

  it("upserts the vote and returns the resulting score", async () => {
    const { svc, upsert } = makeForVoting({
      reviewOwnerId: "author",
      grouped: [
        { reviewId: "r1", value: "UP", _count: { _all: 3 } },
        { reviewId: "r1", value: "DOWN", _count: { _all: 1 } },
      ],
    });
    const result = await svc.vote("viewer", "r1", "UP" as never);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reviewId_userId: { reviewId: "r1", userId: "viewer" } },
      }),
    );
    expect(result).toEqual({ score: 2, myVote: "UP" });
  });

  it("removes the vote on unvote", async () => {
    const { svc, deleteMany } = makeForVoting({ reviewOwnerId: "author" });
    await svc.unvote("viewer", "r1");
    expect(deleteMany).toHaveBeenCalledWith({
      where: { reviewId: "r1", userId: "viewer" },
    });
  });
});

describe("ReviewService.setRating — revision snapshotting", () => {
  it("skips the revision when the rating is unchanged", async () => {
    const { svc, revisionCreate } = makeForWrite({ rating: 8, text: null });
    await svc.setRating("u1", "MEDIA" as never, "m1", 8);
    expect(revisionCreate).not.toHaveBeenCalled();
  });

  it("creates a revision when the rating changed", async () => {
    const { svc, revisionCreate } = makeForWrite({ rating: 6, text: null });
    await svc.setRating("u1", "MEDIA" as never, "m1", 8);
    expect(revisionCreate).toHaveBeenCalledTimes(1);
  });
});
