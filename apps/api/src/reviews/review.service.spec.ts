import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import type { AchievementService } from "../gamification/achievements/achievement.service";
import type { XpService } from "../gamification/xp.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ActivityService } from "../social/activity.service";
import type { VisibilityService } from "../social/visibility.service";
import type { ViewerRelation } from "../social/visibility.util";
import { ReviewService } from "./review.service";

// Stubbed no-op, same pattern as library.service.spec.ts (G1).
function stubXp(): XpService {
  return {
    award: vi.fn(),
    awardMany: vi.fn(),
    revokeBySource: vi.fn(),
  } as unknown as XpService;
}

function stubAchievements(): AchievementService {
  return { evaluate: vi.fn() } as unknown as AchievementService;
}

// Not exercised by most of these tests — kept plain so isGamificationEnabled
// resolves to `false` (config unset, flag fallback false), matching the
// deployment default.
const CONFIG = { get: vi.fn() } as unknown as ConfigService;
const FLAGS = {
  isEnabled: vi.fn((_name: string, fallback: boolean) => fallback),
} as unknown as FeatureFlagsService;

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
      hideProgression: false,
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
    userScore: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const visibility = {
    getRelation: vi.fn((_v: string, target: { id: string }) =>
      Promise.resolve(relations[target.id] ?? relation({})),
    ),
  } as unknown as VisibilityService;
  const activity = { emit: vi.fn() } as unknown as ActivityService;
  return new ReviewService(
    prisma,
    visibility,
    activity,
    stubXp(),
    CONFIG,
    FLAGS,
    stubAchievements(),
  );
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
      findUnique: vi
        .fn()
        .mockResolvedValue(existing ? { id: "r1", ...existing } : null),
      upsert: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue(row),
      create: vi.fn().mockResolvedValue(row),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
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
    userScore: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const activity = { emit: vi.fn() } as unknown as ActivityService;
  const visibility = {} as unknown as VisibilityService;
  const xp = stubXp();
  const achievements = stubAchievements();
  const svc = new ReviewService(
    prisma,
    visibility,
    activity,
    xp,
    CONFIG,
    FLAGS,
    achievements,
  );
  return { svc, revisionCreate, xp, achievements };
}

describe("ReviewService.upsert — revision snapshotting", () => {
  it("creates a revision when the review is new", async () => {
    const { svc, revisionCreate } = makeForWrite(null);
    await svc.upsert("u1", "MEDIA" as never, "m1", { rating: 8, text: null });
    expect(revisionCreate).toHaveBeenCalledTimes(1);
  });

  it("evaluates first_take on a brand-new review, not on an edit", async () => {
    const { svc: fresh, achievements: freshAchievements } = makeForWrite(null);
    await fresh.upsert("u1", "MEDIA" as never, "m1", { rating: 8, text: null });
    expect(freshAchievements.evaluate).toHaveBeenCalledWith("u1", [
      "first_take",
    ]);

    const { svc: edited, achievements: editedAchievements } = makeForWrite({
      rating: 6,
      text: null,
    });
    await edited.upsert("u1", "MEDIA" as never, "m1", {
      rating: 8,
      text: null,
    });
    expect(editedAchievements.evaluate).not.toHaveBeenCalled();
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
  existingVote?: { id: string; value: string } | null;
}) {
  const upsert = vi.fn().mockResolvedValue({ id: "vote-1" });
  const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
  const findUnique = vi.fn().mockResolvedValue(opts.existingVote ?? null);
  const prisma = {
    review: {
      findUnique: vi.fn().mockResolvedValue({ userId: opts.reviewOwnerId }),
    },
    reviewVote: {
      upsert,
      deleteMany,
      findUnique,
      groupBy: vi.fn().mockResolvedValue(opts.grouped ?? []),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;
  const xp = stubXp();
  const achievements = stubAchievements();
  const svc = new ReviewService(
    prisma,
    {} as unknown as VisibilityService,
    {} as unknown as ActivityService,
    xp,
    CONFIG,
    FLAGS,
    achievements,
  );
  return { svc, upsert, deleteMany, xp, achievements };
}

describe("ReviewService.vote", () => {
  it("rejects voting on your own review", async () => {
    const { svc } = makeForVoting({ reviewOwnerId: "author" });
    await expect(svc.vote("author", "r1", "UP" as never)).rejects.toThrow(
      "You cannot vote on your own review",
    );
  });

  it("evaluates crowd_favorite/standing_ovation for the review's author on an UP vote, never on DOWN", async () => {
    const { svc, achievements } = makeForVoting({ reviewOwnerId: "author" });
    await svc.vote("voter", "r1", "UP" as never);
    expect(achievements.evaluate).toHaveBeenCalledWith("author", [
      "crowd_favorite",
      "standing_ovation",
    ]);

    const { svc: downSvc, achievements: downAchievements } = makeForVoting({
      reviewOwnerId: "author",
    });
    await downSvc.vote("voter", "r1", "DOWN" as never);
    expect(downAchievements.evaluate).not.toHaveBeenCalled();
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

  it("credits REVIEW_VOTE_RECEIVED to the review's author on UP, never the voter", async () => {
    const { svc, xp } = makeForVoting({ reviewOwnerId: "author" });
    await svc.vote("viewer", "r1", "UP" as never);
    expect(xp.award).toHaveBeenCalledWith(
      "author",
      "REVIEW_VOTE_RECEIVED",
      "vote-1",
    );
    expect(xp.award).not.toHaveBeenCalledWith(
      "viewer",
      expect.anything(),
      expect.anything(),
    );
  });

  it("never credits a DOWN vote", async () => {
    const { svc, xp } = makeForVoting({ reviewOwnerId: "author" });
    await svc.vote("viewer", "r1", "DOWN" as never);
    expect(xp.award).not.toHaveBeenCalled();
  });

  it("reclaims the credit immediately on an UP -> DOWN flip", async () => {
    const { svc, xp } = makeForVoting({
      reviewOwnerId: "author",
      existingVote: { id: "vote-1", value: "UP" },
    });
    await svc.vote("viewer", "r1", "DOWN" as never);
    expect(xp.revokeBySource).toHaveBeenCalledWith("ReviewVote", ["vote-1"]);
  });

  it("re-awards on a DOWN -> UP flip", async () => {
    const { svc, xp } = makeForVoting({
      reviewOwnerId: "author",
      existingVote: { id: "vote-1", value: "DOWN" },
    });
    await svc.vote("viewer", "r1", "UP" as never);
    expect(xp.award).toHaveBeenCalledWith(
      "author",
      "REVIEW_VOTE_RECEIVED",
      "vote-1",
    );
  });

  it("revokes the credit on unvote, only if the removed vote was UP", async () => {
    const { svc, xp } = makeForVoting({
      reviewOwnerId: "author",
      existingVote: { id: "vote-1", value: "UP" },
    });
    await svc.unvote("viewer", "r1");
    expect(xp.revokeBySource).toHaveBeenCalledWith("ReviewVote", ["vote-1"]);
  });

  it("does not attempt a revoke on unvote when the removed vote was DOWN", async () => {
    const { svc, xp } = makeForVoting({
      reviewOwnerId: "author",
      existingVote: { id: "vote-1", value: "DOWN" },
    });
    await svc.unvote("viewer", "r1");
    expect(xp.revokeBySource).not.toHaveBeenCalled();
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

const LONG_TEXT = Array.from({ length: 45 }, () => "word").join(" "); // >= 40
const VERY_LONG_TEXT = Array.from({ length: 160 }, () => "word").join(" "); // >= 150

describe("ReviewService — WORK_RATED/REVIEW_WRITTEN/REVIEW_DETAILED", () => {
  it("upsert() always awards WORK_RATED, plus REVIEW_WRITTEN/REVIEW_DETAILED once their word thresholds are crossed", async () => {
    const { svc, xp } = makeForWrite(null);
    await svc.upsert("u1", "MEDIA" as never, "m1", {
      rating: 8,
      text: VERY_LONG_TEXT,
    });
    expect(xp.award).toHaveBeenCalledWith("u1", "WORK_RATED", "r1");
    expect(xp.award).toHaveBeenCalledWith("u1", "REVIEW_WRITTEN", "r1");
    expect(xp.award).toHaveBeenCalledWith("u1", "REVIEW_DETAILED", "r1");
  });

  it("upsert() awards only REVIEW_WRITTEN, not REVIEW_DETAILED, between 40 and 150 words", async () => {
    const { svc, xp } = makeForWrite(null);
    await svc.upsert("u1", "MEDIA" as never, "m1", {
      rating: 8,
      text: LONG_TEXT,
    });
    expect(xp.award).toHaveBeenCalledWith("u1", "REVIEW_WRITTEN", "r1");
    expect(xp.award).not.toHaveBeenCalledWith("u1", "REVIEW_DETAILED", "r1");
  });

  it("upsert() awards neither text-length reason for a rating-only review", async () => {
    const { svc, xp } = makeForWrite(null);
    await svc.upsert("u1", "MEDIA" as never, "m1", { rating: 8, text: null });
    expect(xp.award).toHaveBeenCalledWith("u1", "WORK_RATED", "r1");
    expect(xp.award).not.toHaveBeenCalledWith("u1", "REVIEW_WRITTEN", "r1");
  });

  it("setRating() also awards WORK_RATED using the review's existing text", async () => {
    const { svc, xp } = makeForWrite({ rating: 6, text: VERY_LONG_TEXT });
    await svc.setRating("u1", "MEDIA" as never, "m1", 8);
    expect(xp.award).toHaveBeenCalledWith("u1", "WORK_RATED", "r1");
    expect(xp.award).toHaveBeenCalledWith("u1", "REVIEW_DETAILED", "r1");
  });
});

describe("ReviewService — structural review deletion revokes XP", () => {
  it("setRating(null) revokes every reason for the review", async () => {
    const { svc, xp } = makeForWrite({ rating: 8, text: VERY_LONG_TEXT });
    await svc.setRating("u1", "MEDIA" as never, "m1", null);
    expect(xp.revokeBySource).toHaveBeenCalledWith("Review", ["r1"]);
  });

  it("remove() revokes every reason for the review", async () => {
    const { svc, xp } = makeForWrite({ rating: 8, text: VERY_LONG_TEXT });
    await svc.remove("u1", "MEDIA" as never, "m1");
    expect(xp.revokeBySource).toHaveBeenCalledWith("Review", ["r1"]);
  });

  it("removeMany() revokes every reason for each deleted review", async () => {
    const { svc, xp } = makeForWrite({ rating: 8, text: VERY_LONG_TEXT });
    await svc.removeMany("u1", ["r1", "r2"]);
    expect(xp.revokeBySource).toHaveBeenCalledWith("Review", ["r1", "r2"]);
  });
});
