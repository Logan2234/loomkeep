import type { NotificationService } from "../notifications/notification.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { VisibilityService } from "../social/visibility.service";
import type { ViewerRelation } from "../social/visibility.util";
import { CommentService } from "./comment.service";

const AUTHOR = {
  id: "author",
  username: "author",
  displayName: "Author",
  profileAccess: "PUBLIC",
};

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
    comment: Partial<Record<string, jest.Mock>>;
    reaction: Partial<Record<string, jest.Mock>>;
    episodeWatch: Partial<Record<string, jest.Mock>>;
    season: Partial<Record<string, jest.Mock>>;
    libraryEntry: Partial<Record<string, jest.Mock>>;
    gameEntry: Partial<Record<string, jest.Mock>>;
    bookEntry: Partial<Record<string, jest.Mock>>;
    block: Partial<Record<string, jest.Mock>>;
    user: Partial<Record<string, jest.Mock>>;
    relations: Record<string, ViewerRelation>;
  }> = {},
) {
  const prisma = {
    comment: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      ...overrides.comment,
    },
    commentReaction: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      ...overrides.reaction,
    },
    episodeWatch: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.episodeWatch,
    },
    season: {
      findUnique: jest.fn().mockResolvedValue(null),
      ...overrides.season,
    },
    libraryEntry: {
      findUnique: jest.fn().mockResolvedValue(null),
      ...overrides.libraryEntry,
    },
    gameEntry: {
      findUnique: jest.fn().mockResolvedValue(null),
      ...overrides.gameEntry,
    },
    bookEntry: {
      findUnique: jest.fn().mockResolvedValue(null),
      ...overrides.bookEntry,
    },
    block: {
      findFirst: jest.fn().mockResolvedValue(null),
      ...overrides.block,
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.user,
    },
    mediaItem: { findUnique: jest.fn().mockResolvedValue(null) },
    gameItem: { findUnique: jest.fn().mockResolvedValue(null) },
    bookItem: { findUnique: jest.fn().mockResolvedValue(null) },
    musicItem: { findUnique: jest.fn().mockResolvedValue(null) },
  } as unknown as PrismaService;

  const visibility = {
    getRelation: jest.fn((_v: string, target: { id: string }) =>
      Promise.resolve(overrides.relations?.[target.id] ?? relation()),
    ),
  } as unknown as VisibilityService;

  const notifications = { create: jest.fn() } as unknown as NotificationService;

  return {
    svc: new CommentService(prisma, visibility, notifications),
    prisma,
    notifications,
  };
}

describe("CommentService.list — spoiler masking", () => {
  it("masks an EPISODE comment when the viewer hasn't watched it", async () => {
    const { svc } = make({
      comment: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            commentRow({ targetType: "EPISODE", targetId: "e1" }),
          ])
          .mockResolvedValueOnce([]),
      },
      episodeWatch: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const page = await svc.list("viewer", "EPISODE" as never, "e1");
    expect(page.comments[0].masked).toBe(true);
  });

  it("unmasks an EPISODE comment once the viewer has watched it", async () => {
    const { svc } = make({
      comment: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            commentRow({ targetType: "EPISODE", targetId: "e1" }),
          ])
          .mockResolvedValueOnce([]),
      },
      episodeWatch: { findFirst: jest.fn().mockResolvedValue({ id: "w1" }) },
    });
    const page = await svc.list("viewer", "EPISODE" as never, "e1");
    expect(page.comments[0].masked).toBe(false);
  });

  it("masks a SEASON comment until every episode is watched", async () => {
    const { svc } = make({
      comment: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            commentRow({ targetType: "SEASON", targetId: "s1" }),
          ])
          .mockResolvedValueOnce([]),
      },
      season: {
        findUnique: jest.fn().mockResolvedValue({
          episodes: [{ id: "e1" }, { id: "e2" }],
        }),
      },
      episodeWatch: {
        // Shared by isMasked's watched-episode check (needs `episodeId`) and
        // the comment-list streak lookup (needs `userId`/`watchedAt`) — this
        // mock serves both since jest doesn't distinguish by `select`.
        findMany: jest
          .fn()
          .mockResolvedValue([
            { episodeId: "e1", userId: "someone", watchedAt: new Date() },
          ]),
      },
    });
    const page = await svc.list("viewer", "SEASON" as never, "s1");
    expect(page.comments[0].masked).toBe(true);
  });

  it("masks a MEDIA comment until the entry is marked finished", async () => {
    const { svc } = make({
      comment: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            commentRow({ targetType: "MEDIA", targetId: "m1" }),
          ])
          .mockResolvedValueOnce([]),
      },
      libraryEntry: {
        findUnique: jest.fn().mockResolvedValue({ finishedAt: null }),
      },
    });
    const page = await svc.list("viewer", "MEDIA" as never, "m1");
    expect(page.comments[0].masked).toBe(true);
  });

  it("unmasks a MEDIA comment once the entry is finished", async () => {
    const { svc } = make({
      comment: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            commentRow({ targetType: "MEDIA", targetId: "m1" }),
          ])
          .mockResolvedValueOnce([]),
      },
      libraryEntry: {
        findUnique: jest.fn().mockResolvedValue({ finishedAt: new Date() }),
      },
    });
    const page = await svc.list("viewer", "MEDIA" as never, "m1");
    expect(page.comments[0].masked).toBe(false);
  });

  it("never masks MUSIC even if the row somehow carries a spoiler tag", async () => {
    const { svc } = make({
      comment: {
        findMany: jest
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
    expect(page.comments[0].masked).toBe(false);
  });
});

describe("CommentService.list — Figurant pseudonym", () => {
  it("replaces a GHOST author's identity for another viewer", async () => {
    const { svc } = make({
      comment: {
        findMany: jest
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
    expect(page.comments[0].author.anonymized).toBe(true);
    expect(page.comments[0].author.username).toBe("");
    expect(page.comments[0].author.displayName).toMatch(/^Figurant n°\d{6}$/u);
  });

  it("shows the real identity to the Figurant author themself", async () => {
    const { svc } = make({
      comment: {
        findMany: jest
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
    expect(page.comments[0].author.anonymized).toBeUndefined();
    expect(page.comments[0].author.username).toBe("author");
  });
});

describe("CommentService.list — blocking", () => {
  it("drops comments from a blocked author", async () => {
    const { svc } = make({
      comment: {
        findMany: jest
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
    expect(page.comments).toHaveLength(0);
  });
});

describe("CommentService.create", () => {
  it("rejects replying to a reply (flat + one level only)", async () => {
    const { svc } = make({
      comment: {
        findUnique: jest.fn().mockResolvedValue({
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
        findUnique: jest.fn().mockResolvedValue({
          id: "root1",
          authorId: "parentAuthor",
          parentId: null,
        }),
        create: jest
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
        findUnique: jest.fn().mockResolvedValue({
          id: "root1",
          authorId: "parentAuthor",
          parentId: null,
          targetType: "MEDIA",
          targetId: "m1",
        }),
        create: jest
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
        findUnique: jest.fn().mockResolvedValue({
          id: "root1",
          authorId: "parentAuthor",
          parentId: null,
        }),
        create: jest
          .fn()
          .mockResolvedValue(
            commentRow({ id: "reply1", parentId: "root1", authorId: "viewer" }),
          ),
      },
      block: { findFirst: jest.fn().mockResolvedValue({ id: "b1" }) },
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
        create: jest
          .fn()
          .mockResolvedValue(commentRow({ text: "hey @author and @bob" })),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: "bobId" }]),
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
    const findMany = jest.fn().mockResolvedValue([]);
    const { svc } = make({
      comment: {
        create: jest
          .fn()
          .mockResolvedValue(commentRow({ text: "hey @ghosty" })),
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
      comment: { findUnique: jest.fn().mockResolvedValue(commentRow()) },
    });
    await expect(svc.remove("someone-else", "c1")).rejects.toThrow();
  });

  it("soft-deletes: clears text and sets deletedAt", async () => {
    const { svc, prisma } = make({
      comment: { findUnique: jest.fn().mockResolvedValue(commentRow()) },
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
      comment: { findUnique: jest.fn().mockResolvedValue(commentRow()) },
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
        findUnique: jest
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

  it("404s on an already-deleted comment", async () => {
    const { svc } = make({
      comment: {
        findUnique: jest
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
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: "c1",
            deletedAt: null,
            authorId: "author",
          })
          .mockResolvedValueOnce({ targetType: "MEDIA", targetId: "m1" }),
      },
      reaction: { count: jest.fn().mockResolvedValue(10) },
    });
    await svc.react("someone", "c1", "LIKE" as never);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "author", type: "COMMENT_REACTIONS" }),
    );
  });

  it("does not re-notify past the threshold", async () => {
    const { svc, notifications } = make({
      comment: {
        findUnique: jest.fn().mockResolvedValueOnce({
          id: "c1",
          deletedAt: null,
          authorId: "author",
        }),
      },
      reaction: { count: jest.fn().mockResolvedValue(11) },
    });
    await svc.react("someone", "c1", "LIKE" as never);
    expect(notifications.create).not.toHaveBeenCalled();
  });
});
