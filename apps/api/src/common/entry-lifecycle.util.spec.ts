import {
  ActivityType,
  Domain,
  ErrorCode,
  ReviewTargetType,
} from "@loomkeep/shared";
import { vi } from "vitest";
import type { XpService } from "../gamification/xp.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ActivityService } from "../social/activity.service";
import { AppException } from "./app.exception";
import {
  assertEntryOwnership,
  awardNewEntryXp,
  deleteOwnedReplay,
  emitEntryActivity,
  listEntryPage,
  polymorphicTargetCleanup,
  titleContains,
} from "./entry-lifecycle.util";
import { DEFAULT_PAGE_SIZE } from "./pagination.util";

/**
 * These behaviours used to be copied into the four library services, which is
 * how the same `deleteEntry` bug got fixed twice. Now that there is one copy,
 * this is where it is pinned down.
 */

type Row = { id: string; title: string; rank: number };

const SORT_KEYS = ["rank", "title", "stored"] as const;
type SortKey = (typeof SORT_KEYS)[number];

function rows(...specs: [string, number][]): Row[] {
  return specs.map(([title, rank]) => ({ id: title, title, rank }));
}

/**
 * A spec over in-memory rows. "stored" stands for a stored-column sort, which
 * the list hands to `sqlPage` — here, the rows' own order.
 */
function specOf(all: Row[]) {
  const sqlPage = vi.fn((_orderBy: string, skip: number, take: number) =>
    Promise.resolve({
      ids: all.slice(skip, skip + take).map((r) => r.id),
      total: all.length,
    }),
  );
  const rowsFn = vi.fn(() => Promise.resolve([...all]));
  // Loads in reverse, as Postgres may: the page keeps its ranking anyway.
  const load = vi.fn((ids: string[]) =>
    Promise.resolve(
      [...ids].reverse().map((id) => all.find((r) => r.id === id)!),
    ),
  );

  return {
    sqlPage,
    rows: rowsFn,
    load,
    spec: {
      sortKeys: SORT_KEYS,
      defaultSort: "rank" as SortKey,
      compare: (sort: SortKey, a: Row, b: Row) =>
        sort === "title" ? a.title.localeCompare(b.title) : b.rank - a.rank,
      sqlSorts: { stored: (asc: boolean) => (asc ? "asc" : "desc") },
      sqlPage,
      rows: rowsFn,
      load,
    },
  };
}

const titles = (res: { items: Row[] }) => res.items.map((r) => r.title);

describe("listEntryPage", () => {
  it("sorts on the default key when the requested one is unknown", async () => {
    const { spec } = specOf(rows(["a", 1], ["b", 3], ["c", 2]));

    const res = await listEntryPage({ sort: "not-a-key" }, spec);

    expect(titles(res)).toEqual(["b", "c", "a"]);
  });

  it("negates the comparator for an ascending order", async () => {
    const { spec } = specOf(rows(["a", 1], ["b", 3], ["c", 2]));

    const res = await listEntryPage({ sort: "rank", order: "asc" }, spec);

    expect(titles(res)).toEqual(["a", "c", "b"]);
  });

  it("keeps ties in the order the rows came in", async () => {
    const { spec } = specOf(rows(["b", 1], ["a", 1], ["c", 1]));

    const res = await listEntryPage({ order: "asc" }, spec);

    expect(titles(res)).toEqual(["b", "a", "c"]);
  });

  it("lets Postgres page a stored-column sort, without loading every row", async () => {
    const {
      spec,
      rows: rowsFn,
      sqlPage,
    } = specOf(rows(["a", 1], ["b", 2], ["c", 3]));

    const res = await listEntryPage(
      { sort: "stored", order: "asc", page: 2, limit: 2 },
      spec,
    );

    expect(sqlPage).toHaveBeenCalledWith("asc", 2, 2);
    expect(rowsFn).not.toHaveBeenCalled();
    expect(titles(res)).toEqual(["c"]);
    expect(res.total).toBe(3);
    expect(res.hasMore).toBe(false);
  });

  it("ranks every row itself once a filter needs them all", async () => {
    const { spec, sqlPage } = specOf(rows(["a", 1], ["b", 2]));

    const res = await listEntryPage(
      { sort: "stored" },
      { ...spec, keep: (row) => row.title !== "a" },
    );

    expect(sqlPage).not.toHaveBeenCalled();
    expect(titles(res)).toEqual(["b"]);
    // `total` is the filtered count — it drives the "x results" label.
    expect(res.total).toBe(1);
  });

  it("loads only the page, and returns it in ranking order", async () => {
    const { spec, load } = specOf(rows(["a", 1], ["b", 2], ["c", 3]));

    const res = await listEntryPage({ page: 1, limit: 2 }, spec);

    expect(load).toHaveBeenCalledWith(["c", "b"]);
    expect(titles(res)).toEqual(["c", "b"]);
    expect(res.hasMore).toBe(true);
  });

  it("falls back to the shared page size on a missing or absurd limit", async () => {
    const many = rows(
      ...Array.from({ length: 60 }, (_, i): [string, number] => [`t${i}`, i]),
    );
    const { spec } = specOf(many);

    expect((await listEntryPage({}, spec)).items).toHaveLength(
      DEFAULT_PAGE_SIZE,
    );
    expect(
      (await listEntryPage({ limit: 0, page: -3 }, spec)).items,
    ).toHaveLength(DEFAULT_PAGE_SIZE);
  });
});

describe("titleContains", () => {
  it("matches LIKE wildcards literally", () => {
    expect(titleContains("100%_off\\")).toEqual({
      contains: "100\\%\\_off\\\\",
      mode: "insensitive",
    });
  });
});

describe("assertEntryOwnership", () => {
  it("returns the entry to its owner", async () => {
    const entry = { userId: "user-1", id: "entry-1" };

    await expect(
      assertEntryOwnership("user-1", () => Promise.resolve(entry)),
    ).resolves.toBe(entry);
  });

  it("404s a missing entry", async () => {
    await expect(
      assertEntryOwnership("user-1", () => Promise.resolve(null)),
    ).rejects.toMatchObject({ code: ErrorCode.LibraryEntryNotFound });
  });

  it("403s someone else's entry rather than tracking it for them", async () => {
    await expect(
      assertEntryOwnership("user-1", () =>
        Promise.resolve({ userId: "user-2" }),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.LibraryEntryForbidden });
  });
});

describe("emitEntryActivity", () => {
  function stubActivity() {
    return { emit: vi.fn() } as unknown as ActivityService;
  }

  const target = {
    userId: "user-1",
    domain: Domain.GAMES,
    targetType: ReviewTargetType.GAME,
    targetId: "game-1",
  };

  it("emits the milestone for a real status transition", async () => {
    const activity = stubActivity();

    await emitEntryActivity(activity, target, {
      prevStatus: "BACKLOG",
      nextStatus: "COMPLETED",
      prevFavorite: false,
      nextFavorite: false,
    });

    expect(activity.emit).toHaveBeenCalledTimes(1);
    expect(activity.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: ActivityType.FINISHED, homeFeed: true }),
    );
  });

  it("stays silent on an idle patch", async () => {
    const activity = stubActivity();

    await emitEntryActivity(activity, target, {
      prevStatus: "PLAYING",
      nextStatus: "PLAYING",
      prevFavorite: true,
      nextFavorite: true,
    });

    expect(activity.emit).not.toHaveBeenCalled();
  });

  it("emits FAVORITED only on the transition into favourite, off the home feed", async () => {
    const activity = stubActivity();

    await emitEntryActivity(activity, target, {
      prevStatus: "PLAYING",
      nextStatus: "PLAYING",
      prevFavorite: false,
      nextFavorite: true,
    });

    expect(activity.emit).toHaveBeenCalledTimes(1);
    expect(activity.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ActivityType.FAVORITED,
        homeFeed: false,
      }),
    );
  });

  it("does not re-emit FAVORITED when it was already one", async () => {
    const activity = stubActivity();

    await emitEntryActivity(activity, target, {
      prevStatus: "PLAYING",
      nextStatus: "PLAYING",
      prevFavorite: true,
      nextFavorite: false,
    });

    expect(activity.emit).not.toHaveBeenCalled();
  });
});

describe("awardNewEntryXp", () => {
  function stubXp() {
    return { award: vi.fn() } as unknown as XpService;
  }

  it("adds DOMAIN_STARTED to WORK_ADDED on the domain's very first entry", async () => {
    const xp = stubXp();

    await awardNewEntryXp(xp, {
      userId: "user-1",
      entryId: "entry-1",
      domain: Domain.BOOKS,
      countEntries: () => Promise.resolve(1),
    });

    expect(xp.award).toHaveBeenCalledTimes(2);
    expect(xp.award).toHaveBeenLastCalledWith(
      "user-1",
      "DOMAIN_STARTED",
      Domain.BOOKS,
    );
  });

  it("awards WORK_ADDED alone from the second entry on", async () => {
    const xp = stubXp();

    await awardNewEntryXp(xp, {
      userId: "user-1",
      entryId: "entry-2",
      domain: Domain.BOOKS,
      countEntries: () => Promise.resolve(2),
    });

    expect(xp.award).toHaveBeenCalledTimes(1);
    expect(xp.award).toHaveBeenCalledWith("user-1", "WORK_ADDED", "entry-2");
  });
});

describe("deleteOwnedReplay", () => {
  function stubXp() {
    return { revokeBySource: vi.fn() } as unknown as XpService;
  }

  it("removes the replay and revokes its XP", async () => {
    const xp = stubXp();
    const remove = vi.fn().mockResolvedValue(undefined);

    await deleteOwnedReplay(xp, {
      userId: "user-1",
      replayId: "replay-1",
      xpSource: "BookReplay",
      findOwnerId: () => Promise.resolve("user-1"),
      remove,
    });

    expect(remove).toHaveBeenCalled();
    expect(xp.revokeBySource).toHaveBeenCalledWith("BookReplay", ["replay-1"]);
  });

  it("refuses another user's replay without deleting anything", async () => {
    const xp = stubXp();
    const remove = vi.fn();

    await expect(
      deleteOwnedReplay(xp, {
        userId: "user-1",
        replayId: "replay-1",
        xpSource: "BookReplay",
        findOwnerId: () => Promise.resolve("user-2"),
        remove,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.LibraryReplayForbidden });
    expect(remove).not.toHaveBeenCalled();
    expect(xp.revokeBySource).not.toHaveBeenCalled();
  });

  it("404s a replay that is gone", async () => {
    await expect(
      deleteOwnedReplay(stubXp(), {
        userId: "user-1",
        replayId: "replay-1",
        xpSource: "BookReplay",
        findOwnerId: () => Promise.resolve(null),
        remove: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(AppException);
  });
});

describe("polymorphicTargetCleanup", () => {
  it("deletes the reviews and tombstones the comments for every target id", () => {
    const prisma = {
      review: { deleteMany: vi.fn(() => "reviews") },
      comment: { updateMany: vi.fn(() => "comments") },
    } as unknown as PrismaService;

    const ops = polymorphicTargetCleanup(prisma, "user-1", ["work-1", "ep-1"]);

    expect(ops).toEqual(["reviews", "comments"]);
    expect(prisma.review.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", targetId: { in: ["work-1", "ep-1"] } },
    });
    // A comment is tombstoned, never deleted: replies hang off it.
    expect(prisma.comment.updateMany).toHaveBeenCalledWith({
      where: {
        authorId: "user-1",
        targetId: { in: ["work-1", "ep-1"] },
        deletedAt: null,
      },
      data: { text: null, deletedAt: expect.any(Date) },
    });
  });
});
