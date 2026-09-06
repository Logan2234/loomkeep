import type { ConfigService } from "@nestjs/config";
import { type Mock, vi } from "vitest";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import type { AchievementService } from "../gamification/achievements/achievement.service";
import type { XpService } from "../gamification/xp.service";
import type { NotificationService } from "../notifications/notification.service";
import type { PrismaService } from "../prisma/prisma.service";
import { BlockService } from "../social/block.service";
import type { VisibilityService } from "../social/visibility.service";
import type { ViewerRelation } from "../social/visibility.util";
import { CommentService } from "./comment.service";

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

const AUTHOR = {
  id: "author",
  username: "author",
  displayName: "Author",
  profileAccess: "PUBLIC",
  hideProgression: false,
};

// Not exercised by most of these tests — kept plain so isGamificationEnabled
// resolves to `false` (config unset, flag fallback false), matching the
// deployment default.
const CONFIG = { get: vi.fn() } as unknown as ConfigService;
const FLAGS = {
  isEnabled: vi.fn((_name: string, fallback: boolean) => fallback),
} as unknown as FeatureFlagsService;

function relation(over: Partial<ViewerRelation> = {}): ViewerRelation {
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

function commentRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "c1",
    targetType: "MEDIA",
    targetId: "m1",
    parentId: null,
    authorId: AUTHOR.id,
    text: "hello",
    spoilerTag: false,
    edited: false,
    deletedAt: null,
    deletedByAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: AUTHOR,
    ...over,
  };
}

function make(
  overrides: Partial<{
    comment: Partial<Record<string, Mock>>;
    reaction: Partial<Record<string, Mock>>;
    episodeWatch: Partial<Record<string, Mock>>;
    season: Partial<Record<string, Mock>>;
    libraryEntry: Partial<Record<string, Mock>>;
    gameEntry: Partial<Record<string, Mock>>;
    bookEntry: Partial<Record<string, Mock>>;
    block: Partial<Record<string, Mock>>;
    user: Partial<Record<string, Mock>>;
    relations: Record<string, ViewerRelation>;
  }> = {},
) {
  const prisma = {
    comment: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      ...overrides.comment,
    },
    commentReaction: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      upsert: vi.fn().mockResolvedValue({ id: "reaction-1" }),
      findUnique: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn(),
      ...overrides.reaction,
    },
    episodeWatch: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides.episodeWatch,
    },
    season: {
      findUnique: vi.fn().mockResolvedValue(null),
      ...overrides.season,
    },
    libraryEntry: {
      findUnique: vi.fn().mockResolvedValue(null),
      ...overrides.libraryEntry,
    },
    gameEntry: {
      findUnique: vi.fn().mockResolvedValue(null),
      ...overrides.gameEntry,
    },
    bookEntry: {
      findUnique: vi.fn().mockResolvedValue(null),
      ...overrides.bookEntry,
    },
    block: {
      findFirst: vi.fn().mockResolvedValue(null),
      ...overrides.block,
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides.user,
    },
    mediaItem: { findUnique: vi.fn().mockResolvedValue(null) },
    gameItem: { findUnique: vi.fn().mockResolvedValue(null) },
    bookItem: { findUnique: vi.fn().mockResolvedValue(null) },
    musicItem: { findUnique: vi.fn().mockResolvedValue(null) },
    userScore: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;

  const visibility = {
    getRelation: vi.fn((_v: string, target: { id: string }) =>
      Promise.resolve(overrides.relations?.[target.id] ?? relation()),
    ),
  } as unknown as VisibilityService;

  const notifications = { create: vi.fn() } as unknown as NotificationService;
  const xp = stubXp();
  const achievements = stubAchievements();
  const blocks = new BlockService(prisma);

  return {
    svc: new CommentService(
      prisma,
      visibility,
      notifications,
      xp,
      CONFIG,
      FLAGS,
      achievements,
      blocks,
    ),
    prisma,
    notifications,
    xp,
    achievements,
  };
}

describe("CommentService.list — spoiler masking", () => {
  it("masks a comment its author tagged as spoiler", async () => {
    const { svc } = make({
      comment: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            commentRow({
              targetType: "EPISODE",
              targetId: "e1",
              spoilerTag: true,
            }),
          ])
          .mockResolvedValueOnce([]),
      },
    });
    const page = await svc.list("viewer", "EPISODE" as never, "e1");
    expect(page.items[0].masked).toBe(true);
  });

  it("does not mask a comment without a spoiler tag", async () => {
    const { svc } = make({
      comment: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            commentRow({
              targetType: "MEDIA",
              targetId: "m1",
              spoilerTag: false,
            }),
          ])
          .mockResolvedValueOnce([]),
      },
    });
    const page = await svc.list("viewer", "MEDIA" as never, "m1");
    expect(page.items[0].masked).toBe(false);
  });

  it("never masks MUSIC even if the row somehow carries a spoiler tag", async () => {
    const { svc } = make({
      comment: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            commentRow({
              targetType: "MUSIC",
              targetId: "al1",
              spoilerTag: true,
            }),
          ])
          .mockResolvedValueOnce([]),
      },
    });
    const page = await svc.list("viewer", "MUSIC" as never, "al1");
    expect(page.items[0].masked).toBe(false);
  });
});

describe("CommentService.list — Figurant pseudonym", () => {
  it("replaces a GHOST author's identity for another viewer", async () => {
    const { svc } = make({
      comment: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            commentRow({
              author: { ...AUTHOR, id: "ghost1", profileAccess: "GHOST" },
            }),
          ])
          .mockResolvedValueOnce([]),
      },
    });
    const page = await svc.list("viewer", "MEDIA" as never, "m1");
    expect(page.items[0].author!.anonymized).toBe(true);
    expect(page.items[0].author!.username).toBe("");
    expect(page.items[0].author!.displayName).toMatch(/^Figurant n°\d{6}$/u);
  });

  it("shows the real identity to the Figurant author themself", async () => {
    const { svc } = make({
      comment: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            commentRow({
              authorId: "ghost1",
              author: { ...AUTHOR, id: "ghost1", profileAccess: "GHOST" },
            }),
          ])
          .mockResolvedValueOnce([]),
      },
    });
    const page = await svc.list("ghost1", "MEDIA" as never, "m1");
    expect(page.items[0].author!.anonymized).toBeUndefined();
    expect(page.items[0].author!.username).toBe("author");
  });
});

describe("CommentService.list — blocking", () => {
  it("drops comments from a blocked author", async () => {
    const { svc } = make({
      comment: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            commentRow({
              id: "blocked",
              authorId: "stranger",
              author: { ...AUTHOR, id: "stranger" },
            }),
          ])
          .mockResolvedValueOnce([]),
      },
      relations: { stranger: relation({ blocking: true }) },
    });
    const page = await svc.list("viewer", "MEDIA" as never, "m1");
    expect(page.items).toHaveLength(0);
  });
});

describe("CommentService.create", () => {
  it("evaluates the comment-family achievements after posting, regardless of the XP length threshold", async () => {
    const { svc, achievements } = make({
      comment: {
        create: vi.fn().mockResolvedValue(commentRow({ id: "c1", text: "hi" })), // under the 15-char XP threshold
      },
    });

    await svc.create("viewer", {
      targetType: "MEDIA" as never,
      targetId: "m1",
      text: "hi",
    });

    expect(achievements.evaluate).toHaveBeenCalledWith("viewer", [
      "first_comment",
      "chatterbox_bronze",
      "chatterbox_silver",
      "chatterbox_gold",
      "icebreaker",
    ]);
  });

  it("rejects replying to a reply (flat + one level only)", async () => {
    const { svc } = make({
      comment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "reply1",
          authorId: "someone",
          parentId: "root1",
        }),
      },
    });
    await expect(
      svc.create("viewer", {
        targetType: "MEDIA" as never,
        targetId: "m1",
        parentId: "reply1",
        text: "hi",
      }),
    ).rejects.toThrow();
  });

  it("notifies the parent author on a reply, not itself", async () => {
    const { svc, notifications } = make({
      comment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "root1",
          authorId: "parentAuthor",
          parentId: null,
        }),
        create: vi
          .fn()
          .mockResolvedValue(
            commentRow({ id: "reply1", parentId: "root1", authorId: "viewer" }),
          ),
      },
    });
    await svc.create("viewer", {
      targetType: "MEDIA" as never,
      targetId: "m1",
      parentId: "root1",
      text: "thanks",
    });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "parentAuthor",
        type: "COMMENT_REPLY",
      }),
    );
  });

  it("always targets whatever its parent targets, ignoring a mismatched body", async () => {
    const { svc, prisma } = make({
      comment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "root1",
          authorId: "parentAuthor",
          parentId: null,
          targetType: "MEDIA",
          targetId: "m1",
        }),
        create: vi
          .fn()
          .mockResolvedValue(
            commentRow({ id: "reply1", parentId: "root1", authorId: "viewer" }),
          ),
      },
    });
    await svc.create("viewer", {
      // A client claiming MUSIC (never masked) on a reply to a MEDIA thread
      // must not be able to smuggle a different target than its parent.
      targetType: "MUSIC" as never,
      targetId: "al1",
      parentId: "root1",
      text: "thanks",
    });
    expect(prisma.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ targetType: "MEDIA", targetId: "m1" }),
      }),
    );
  });

  it("does not notify a reply when the parent author blocked the commenter", async () => {
    const { svc, notifications } = make({
      comment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "root1",
          authorId: "parentAuthor",
          parentId: null,
        }),
        create: vi
          .fn()
          .mockResolvedValue(
            commentRow({ id: "reply1", parentId: "root1", authorId: "viewer" }),
          ),
      },
      block: { findFirst: vi.fn().mockResolvedValue({ id: "b1" }) },
    });
    await svc.create("viewer", {
      targetType: "MEDIA" as never,
      targetId: "m1",
      parentId: "root1",
      text: "thanks",
    });
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("notifies a mentioned user but not the author mentioning themselves", async () => {
    const { svc, notifications } = make({
      comment: {
        create: vi
          .fn()
          .mockResolvedValue(commentRow({ text: "hey @author and @bob" })),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: "bobId" }]),
      },
    });
    await svc.create(AUTHOR.id, {
      targetType: "MEDIA" as never,
      targetId: "m1",
      text: "hey @author and @bob",
    });
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "bobId", type: "COMMENT_MENTION" }),
    );
  });

  it("excludes Figurants from mention resolution (unaddressable)", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const { svc } = make({
      comment: {
        create: vi.fn().mockResolvedValue(commentRow({ text: "hey @ghosty" })),
      },
      user: { findMany },
    });
    await svc.create(AUTHOR.id, {
      targetType: "MEDIA" as never,
      targetId: "m1",
      text: "hey @ghosty",
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          profileAccess: { not: "GHOST" },
        }),
      }),
    );
  });
});

describe("CommentService.remove", () => {
  it("rejects deleting someone else's comment", async () => {
    const { svc } = make({
      comment: { findUnique: vi.fn().mockResolvedValue(commentRow()) },
    });
    await expect(svc.remove("someone-else", "c1")).rejects.toThrow();
  });

  it("soft-deletes: clears text and sets deletedAt", async () => {
    const { svc, prisma } = make({
      comment: { findUnique: vi.fn().mockResolvedValue(commentRow()) },
    });
    await svc.remove(AUTHOR.id, "c1");
    expect(prisma.comment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: expect.objectContaining({ text: null }),
      }),
    );
  });

  it("does not flag a self-delete as an admin takedown", async () => {
    const { svc, prisma } = make({
      comment: { findUnique: vi.fn().mockResolvedValue(commentRow()) },
    });
    await svc.remove(AUTHOR.id, "c1");
    expect(prisma.comment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedByAdmin: false }),
      }),
    );
  });
});

describe("CommentService.adminRemove", () => {
  it("soft-deletes without checking ownership (moderation takedown)", async () => {
    const { svc, prisma } = make({
      comment: {
        findUnique: vi
          .fn()
          .mockResolvedValue(commentRow({ authorId: "someone-else" })),
      },
    });
    await svc.adminRemove("c1");
    expect(prisma.comment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: expect.objectContaining({ text: null, deletedByAdmin: true }),
      }),
    );
  });

  it("returns the pre-tombstone author/text for the moderation notice", async () => {
    const { svc } = make({
      comment: {
        findUnique: vi
          .fn()
          .mockResolvedValue(
            commentRow({ authorId: "someone-else", text: "insulte gratuite" }),
          ),
      },
    });
    await expect(svc.adminRemove("c1")).resolves.toEqual({
      authorId: "someone-else",
      text: "insulte gratuite",
    });
  });

  it("404s on an already-deleted comment", async () => {
    const { svc } = make({
      comment: {
        findUnique: vi
          .fn()
          .mockResolvedValue(commentRow({ deletedAt: new Date() })),
      },
    });
    await expect(svc.adminRemove("c1")).rejects.toThrow();
  });
});

describe("CommentService.react", () => {
  it("notifies the author once the reaction count reaches the threshold", async () => {
    const { svc, notifications } = make({
      comment: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: "c1",
            deletedAt: null,
            authorId: "author",
          })
          .mockResolvedValueOnce({ targetType: "MEDIA", targetId: "m1" }),
      },
      reaction: { count: vi.fn().mockResolvedValue(10) },
    });
    await svc.react("someone", "c1", "LIKE" as never);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "author", type: "COMMENT_REACTIONS" }),
    );
  });

  it("does not re-notify past the threshold", async () => {
    const { svc, notifications } = make({
      comment: {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: "c1",
          deletedAt: null,
          authorId: "author",
        }),
      },
      reaction: { count: vi.fn().mockResolvedValue(11) },
    });
    await svc.react("someone", "c1", "LIKE" as never);
    expect(notifications.create).not.toHaveBeenCalled();
  });
});

describe("CommentService — XP wiring", () => {
  it("awards COMMENT_POSTED only when the trimmed text reaches 15 characters", async () => {
    const { svc, xp } = make({
      comment: {
        create: vi
          .fn()
          .mockResolvedValue(commentRow({ id: "c1", text: "too short" })),
      },
    });
    await svc.create("author", {
      targetType: "MEDIA" as never,
      targetId: "m1",
      text: "too short",
    });
    expect(xp.award).not.toHaveBeenCalled();

    const { svc: svc2, xp: xp2 } = make({
      comment: {
        create: vi
          .fn()
          .mockResolvedValue(
            commentRow({ id: "c2", text: "this comment is long enough" }),
          ),
      },
    });
    await svc2.create("author", {
      targetType: "MEDIA" as never,
      targetId: "m1",
      text: "this comment is long enough",
    });
    expect(xp2.award).toHaveBeenCalledWith("author", "COMMENT_POSTED", "c2");
  });

  it("revokes COMMENT_POSTED on remove", async () => {
    const { svc, xp } = make({
      comment: {
        findUnique: vi
          .fn()
          .mockResolvedValue(commentRow({ id: "c1", authorId: "author" })),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    await svc.remove("author", "c1");
    expect(xp.revokeBySource).toHaveBeenCalledWith("Comment", ["c1"]);
  });

  it("credits COMMENT_REACTION_RECEIVED to the comment's author, never the reactor", async () => {
    const { svc, xp } = make({
      comment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          deletedAt: null,
          authorId: "author",
        }),
      },
      reaction: { upsert: vi.fn().mockResolvedValue({ id: "reaction-1" }) },
    });
    await svc.react("reactor", "c1", "LIKE" as never);
    expect(xp.award).toHaveBeenCalledWith(
      "author",
      "COMMENT_REACTION_RECEIVED",
      "reaction-1",
    );
    expect(xp.award).not.toHaveBeenCalledWith(
      "reactor",
      expect.anything(),
      expect.anything(),
    );
  });

  it("revokes COMMENT_REACTION_RECEIVED on unreact", async () => {
    const { svc, xp } = make({
      reaction: {
        findUnique: vi.fn().mockResolvedValue({ id: "reaction-1" }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    });
    await svc.unreact("reactor", "c1");
    expect(xp.revokeBySource).toHaveBeenCalledWith("CommentReaction", [
      "reaction-1",
    ]);
  });
});
