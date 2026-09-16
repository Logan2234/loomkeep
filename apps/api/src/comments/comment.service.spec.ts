import type { ConfigService } from "@nestjs/config";
import { type Mock, vi } from "vitest";
import { AppException } from "../common/app.exception";
import type { EventsGateway } from "../events/events.gateway";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import type { AchievementService } from "../gamification/achievements/achievement.service";
import type { XpService } from "../gamification/xp.service";
import type { NotificationService } from "../notifications/notification.service";
import type { PrismaService } from "../prisma/prisma.service";
import { BlockService } from "../social/block.service";
import type { VisibilityService } from "../social/visibility.service";
import type { ViewerRelation } from "../social/visibility.util";
import { CommentService, REPLY_PREVIEW_LIMIT } from "./comment.service";

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

const TARGET_ROW = {
  id: "target-1",
  type: "SERIES",
  canonicalSource: "TMDB",
  externalIds: [],
};

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
    // list() reads both through the nested include on its single query.
    replies: [],
    _count: { replies: 0 },
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
    episode: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    libraryEntry: {
      findUnique: vi.fn().mockResolvedValue({ id: "entry-1" }),
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
    // Present by default: create() checks the target exists before writing a
    // comment against it (the pair is polymorphic, so nothing else would).
    // The test for that guard overrides these back to null.
    // Shaped for both readers of these tables: workTargetExists() only needs a
    // row to exist, resolveWorkHref() destructures canonicalSource/externalIds.
    // An empty externalIds keeps the href null, as it was when these mocks
    // returned nothing at all.
    mediaItem: { findUnique: vi.fn().mockResolvedValue(TARGET_ROW) },
    gameItem: { findUnique: vi.fn().mockResolvedValue(TARGET_ROW) },
    bookItem: { findUnique: vi.fn().mockResolvedValue(TARGET_ROW) },
    musicItem: { findUnique: vi.fn().mockResolvedValue(TARGET_ROW) },
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
  const events = { emitToCommentsThread: vi.fn() } as unknown as EventsGateway;

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
      events,
    ),
    prisma,
    notifications,
    xp,
    achievements,
    events,
  };
}

describe("CommentService.list — spoiler masking", () => {
  it("masks a comment its author tagged as spoiler", async () => {
    const { svc } = make({
      comment: {
        findMany: vi.fn().mockResolvedValueOnce([
          commentRow({
            targetType: "EPISODE",
            targetId: "e1",
            spoilerTag: true,
          }),
        ]),
      },
    });
    const page = await svc.list("viewer", "EPISODE" as never, "e1");
    expect(page.items[0].masked).toBe(true);
  });

  it("does not mask a comment without a spoiler tag", async () => {
    const { svc } = make({
      comment: {
        findMany: vi.fn().mockResolvedValueOnce([
          commentRow({
            targetType: "MEDIA",
            targetId: "m1",
            spoilerTag: false,
          }),
        ]),
      },
    });
    const page = await svc.list("viewer", "MEDIA" as never, "m1");
    expect(page.items[0].masked).toBe(false);
  });

  it("never masks MUSIC even if the row somehow carries a spoiler tag", async () => {
    const { svc } = make({
      comment: {
        findMany: vi.fn().mockResolvedValueOnce([
          commentRow({
            targetType: "MUSIC",
            targetId: "al1",
            spoilerTag: true,
          }),
        ]),
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
        findMany: vi.fn().mockResolvedValueOnce([
          commentRow({
            author: { ...AUTHOR, id: "ghost1", profileAccess: "GHOST" },
          }),
        ]),
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
        findMany: vi.fn().mockResolvedValueOnce([
          commentRow({
            authorId: "ghost1",
            author: { ...AUTHOR, id: "ghost1", profileAccess: "GHOST" },
          }),
        ]),
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
        findMany: vi.fn().mockResolvedValueOnce([
          commentRow({
            id: "blocked",
            authorId: "stranger",
            author: { ...AUTHOR, id: "stranger" },
          }),
        ]),
      },
      relations: { stranger: relation({ blocking: true }) },
    });
    const page = await svc.list("viewer", "MEDIA" as never, "m1");
    expect(page.items).toHaveLength(0);
  });
});

describe("CommentService.list — reply preview", () => {
  function replies(count: number) {
    return Array.from({ length: count }, (_, i) =>
      commentRow({ id: `r${i}`, parentId: "c1" }),
    );
  }

  it("embeds only the preview slice, however many replies the thread holds", async () => {
    const { svc } = make({
      comment: {
        findMany: vi.fn().mockResolvedValue([
          commentRow({
            // What Prisma returns for `take: -REPLY_PREVIEW_LIMIT`: the tail
            // only, with the real total alongside it.
            replies: replies(REPLY_PREVIEW_LIMIT),
            _count: { replies: 250 },
          }),
        ]),
      },
    });

    const page = await svc.list("viewer", "MEDIA" as never, "m1");

    expect(page.items[0].replies).toHaveLength(REPLY_PREVIEW_LIMIT);
    expect(page.items[0].replyCount).toBe(250);
  });

  it("asks the database for the preview slice rather than the whole thread", async () => {
    const findMany = vi.fn().mockResolvedValue([commentRow()]);
    const { svc } = make({ comment: { findMany } });

    await svc.list("viewer", "MEDIA" as never, "m1");

    // The regression this guards: replies used to be fetched in a second,
    // unbounded query, so one popular comment decided the response size.
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].include.replies.take).toBe(
      -REPLY_PREVIEW_LIMIT,
    );
  });

  it("drops a blocked author from the preview without touching the count", async () => {
    const { svc } = make({
      comment: {
        findMany: vi.fn().mockResolvedValue([
          commentRow({
            replies: [
              commentRow({ id: "r0", parentId: "c1" }),
              commentRow({
                id: "r1",
                parentId: "c1",
                authorId: "stranger",
                author: { ...AUTHOR, id: "stranger" },
              }),
            ],
            _count: { replies: 2 },
          }),
        ]),
      },
      relations: { stranger: relation({ blocking: true }) },
    });

    const page = await svc.list("viewer", "MEDIA" as never, "m1");

    expect(page.items[0].replies.map((r) => r.id)).toEqual(["r0"]);
    expect(page.items[0].replyCount).toBe(2);
  });
});

describe("CommentService.listReplies", () => {
  it("pages one thread newest-first and reports whether more remain", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        commentRow({ id: "r0", parentId: "c1" }),
        commentRow({ id: "r1", parentId: "c1" }),
      ]);
    const { svc } = make({ comment: { findMany } });

    const page = await svc.listReplies("viewer", "c1", 1, 1);

    expect(page.items.map((r) => r.id)).toEqual(["r0"]);
    expect(page.hasMore).toBe(true);
    expect(findMany.mock.calls[0][0].orderBy[0]).toEqual({ createdAt: "desc" });
    expect(findMany.mock.calls[0][0].where).toEqual({
      parentId: "c1",
      deletedAt: null,
    });
  });
});

describe("CommentService.create", () => {
  it("refuses a root comment whose target does not exist", async () => {
    const { svc, prisma } = make({
      comment: { create: vi.fn() },
    });
    (prisma.mediaItem.findUnique as Mock).mockResolvedValue(null);

    await expect(
      svc.create(AUTHOR.id, {
        targetType: "MEDIA",
        targetId: "does-not-exist",
        text: "a comment on nothing at all",
      }),
    ).rejects.toBeInstanceOf(AppException);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

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

  it("rejects a reply when the parent author blocked the commenter", async () => {
    const { svc, prisma } = make({
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
    await expect(
      svc.create("viewer", {
        targetType: "MEDIA" as never,
        targetId: "m1",
        parentId: "root1",
        text: "thanks",
      }),
    ).rejects.toThrow();
    expect(prisma.comment.create).not.toHaveBeenCalled();
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
  it("requires the work to be tracked before reacting", async () => {
    const { svc, prisma } = make({
      comment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          deletedAt: null,
          authorId: "author",
          targetType: "MEDIA",
          targetId: "m1",
        }),
      },
      libraryEntry: { findUnique: vi.fn().mockResolvedValue(null) },
    });

    await expect(svc.react("viewer", "c1", "LIKE" as never)).rejects.toThrow();
    expect(prisma.commentReaction.upsert).not.toHaveBeenCalled();
  });

  it("rejects reacting to a blocked account", async () => {
    const { svc, prisma } = make({
      comment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          deletedAt: null,
          authorId: "author",
          targetType: "MEDIA",
          targetId: "m1",
        }),
      },
      block: { findFirst: vi.fn().mockResolvedValue({ id: "block-1" }) },
    });

    await expect(svc.react("viewer", "c1", "LIKE" as never)).rejects.toThrow();
    expect(prisma.commentReaction.upsert).not.toHaveBeenCalled();
  });

  it("notifies the author once the reaction count reaches the threshold", async () => {
    const { svc, notifications } = make({
      comment: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: "c1",
            deletedAt: null,
            authorId: "author",
            targetType: "MEDIA",
            targetId: "m1",
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
          targetType: "MEDIA",
          targetId: "m1",
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
          targetType: "MEDIA",
          targetId: "m1",
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

  it("credits nothing when the author reacts to their own comment", async () => {
    const { svc, xp } = make({
      comment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          deletedAt: null,
          authorId: "author",
          targetType: "MEDIA",
          targetId: "m1",
        }),
      },
      reaction: { upsert: vi.fn().mockResolvedValue({ id: "reaction-1" }) },
    });
    await svc.react("author", "c1", "LIKE" as never);
    expect(xp.award).not.toHaveBeenCalled();
  });

  it("revokes COMMENT_REACTION_RECEIVED on unreact", async () => {
    const { svc, xp } = make({
      reaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: "reaction-1",
          comment: { targetType: "MEDIA", targetId: "m1" },
        }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      comment: {
        findUnique: vi.fn().mockResolvedValue({
          deletedAt: null,
          authorId: "author",
          targetType: "MEDIA",
          targetId: "m1",
        }),
      },
    });
    await svc.unreact("reactor", "c1");
    expect(xp.revokeBySource).toHaveBeenCalledWith("CommentReaction", [
      "reaction-1",
    ]);
  });
});

describe("CommentService — realtime push", () => {
  it("notifies the target's thread when a comment is created", async () => {
    const { svc, events } = make({
      comment: {
        create: vi.fn().mockResolvedValue(commentRow({ id: "c1" })),
      },
    });
    await svc.create("author", {
      targetType: "MEDIA" as never,
      targetId: "m1",
      text: "this comment is long enough",
    });
    expect(events.emitToCommentsThread).toHaveBeenCalledWith(
      "MEDIA",
      "m1",
      "comment-changed",
    );
  });

  it("notifies the target's thread on react and unreact", async () => {
    const { svc, events } = make({
      comment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "c1",
          deletedAt: null,
          authorId: "author",
          targetType: "MEDIA",
          targetId: "m1",
        }),
      },
      reaction: {
        upsert: vi.fn().mockResolvedValue({ id: "reaction-1" }),
        findUnique: vi.fn().mockResolvedValue({
          id: "reaction-1",
          comment: { targetType: "MEDIA", targetId: "m1" },
        }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    });

    await svc.react("reactor", "c1", "LIKE" as never);
    await svc.unreact("reactor", "c1");

    expect(events.emitToCommentsThread).toHaveBeenCalledWith(
      "MEDIA",
      "m1",
      "comment-changed",
    );
    expect(events.emitToCommentsThread).toHaveBeenCalledTimes(2);
  });
});
