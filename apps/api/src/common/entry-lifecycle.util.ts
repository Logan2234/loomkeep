import type { Domain, PagedResult, ReviewTargetType } from "@loomkeep/shared";
import { ActivityType, ErrorCode, XpReason } from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { XpService } from "../gamification/xp.service";
import type { PrismaService } from "../prisma/prisma.service";
import { classifyStatusTransition } from "../social/activity-transition.util";
import type { ActivityService } from "../social/activity.service";
import { AppException } from "./app.exception";
import { DEFAULT_PAGE_SIZE } from "./pagination.util";

/**
 * What the four library domains (media, books, games, music) share of their
 * entry lifecycle.
 *
 * Each domain keeps its own service and its own Prisma delegate — the tables,
 * statuses and XP reasons genuinely differ. What lives here is the behaviour
 * that belongs to the product rather than to any one domain: the activity
 * matrix, the XP owed by a new entry, the list contract, and the
 * polymorphic Review/Comment cleanup an entry removal owes. Those are exactly
 * the places where a fix used to land in three domains out of four — the
 * `deleteEntry` comments about commit `0db5dc6` are that bug, found twice.
 *
 * Free functions taking the services they need, rather than a base class: a
 * base class could only own what all four agree on, and MEDIA disagrees on
 * nearly every Prisma call (seasons and episodes in the delete, batched
 * progress and translated titles in the list, a derived DORMANT status). It
 * would have covered the other three and left MEDIA out — the same failure
 * mode over again.
 */

/** Query contract shared by every library list endpoint. */
export interface ListEntriesFilters {
  q?: string;
  favorite?: boolean;
  statuses?: string[];
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
  /** The signed-in user's locale, when known — drives alphabetical collation. */
  lang?: string;
}

export interface EntryStatusChange {
  prevStatus: string | null;
  nextStatus: string;
  prevFavorite: boolean;
  nextFavorite: boolean;
}

export interface EntryActivityTarget {
  userId: string;
  domain: Domain;
  targetType: ReviewTargetType;
  targetId: string;
}

/**
 * The activity events a library write owes: a status milestone (via the shared
 * transition rules) and, separately, FAVORITED when a work is newly
 * favourited — profile timeline only, per the matrix.
 */
export async function emitEntryActivity(
  activity: ActivityService,
  target: EntryActivityTarget,
  change: EntryStatusChange,
): Promise<void> {
  const transition = classifyStatusTransition(
    target.domain,
    change.prevStatus,
    change.nextStatus,
  );

  if (transition) {
    await activity.emit({
      userId: target.userId,
      type: transition.type,
      domain: target.domain,
      targetType: target.targetType,
      targetId: target.targetId,
      homeFeed: transition.homeFeed,
    });
  }

  if (change.nextFavorite && !change.prevFavorite) {
    await activity.emit({
      userId: target.userId,
      type: ActivityType.FAVORITED,
      domain: target.domain,
      targetType: target.targetType,
      targetId: target.targetId,
      homeFeed: false,
    });
  }
}

/**
 * XP owed by a true first insert, never an update: WORK_ADDED, plus the one-off
 * DOMAIN_STARTED when it is the user's very first entry in that domain (see the
 * [G1b] plan). `countEntries` stays with the caller because each domain counts
 * its own entry table.
 */
export async function awardNewEntryXp(
  xp: XpService,
  args: {
    userId: string;
    entryId: string;
    domain: Domain;
    countEntries: () => Promise<number>;
  },
): Promise<void> {
  await xp.award(args.userId, XpReason.WORK_ADDED, args.entryId);

  if ((await args.countEntries()) === 1) {
    await xp.award(args.userId, XpReason.DOMAIN_STARTED, args.domain);
  }
}

/**
 * How one domain's list is filtered, ranked and loaded. `Row` is what ranking
 * reads — a light slice of the entry — and `T` the full DTO a page returns.
 */
interface EntryListSpec<
  Row extends { id: string },
  T extends { id: string },
  K extends string,
  Order,
> {
  sortKeys: readonly K[];
  defaultSort: K;
  /** Natural order per criterion; `order: "asc"` negates it. */
  compare: (sort: K, a: Row, b: Row, locale: string | undefined) => number;
  /**
   * The sorts Postgres can apply itself — a stored column, unset values last
   * in the natural order — as an `orderBy`, reversed when `asc`.
   */
  sqlSorts?: Partial<Record<K, (asc: boolean) => Order>>;
  /** One page of matching ids under `orderBy`, and how many match in all. */
  sqlPage?: (
    orderBy: Order,
    skip: number,
    take: number,
  ) => Promise<{ ids: string[]; total: number }>;
  /** Every matching entry as a light row, the most recently updated first. */
  rows: (sort: K) => Promise<Row[]>;
  /** A filter Postgres can't apply — media's derived status. */
  keep?: (row: Row) => boolean;
  /** The page's entries as full DTOs, in any order. */
  load: (ids: string[]) => Promise<T[]>;
}

/**
 * One page of a library list, in two steps so that only the page is ever
 * loaded in full: first which entries make the page, then those entries.
 *
 * A stored-column sort lets Postgres pick the page. Any other — derived
 * (progress, effective status), read from another table (rating), or
 * alphabetical, whose locale-aware collation Postgres doesn't share — ranks
 * light rows of every matching entry here instead. Ties keep the most
 * recently updated entry first either way: `rows` comes in that order and
 * the sort is stable, and `sqlPage` breaks ties the same.
 */
export async function listEntryPage<
  Row extends { id: string },
  T extends { id: string },
  K extends string,
  Order,
>(
  filters: ListEntriesFilters,
  spec: EntryListSpec<Row, T, K, Order>,
): Promise<PagedResult<T>> {
  // The key is taken from `sortKeys`, never from the query itself.
  const sort =
    spec.sortKeys.find((key) => key === filters.sort) ?? spec.defaultSort;
  const asc = filters.order === "asc";
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const limit =
    filters.limit && filters.limit > 0 ? filters.limit : DEFAULT_PAGE_SIZE;
  const skip = (page - 1) * limit;

  const sqlSort =
    spec.keep || !spec.sqlSorts || !Object.hasOwn(spec.sqlSorts, sort)
      ? undefined
      : spec.sqlSorts[sort];
  let ids: string[];
  let total: number;

  if (sqlSort && spec.sqlPage) {
    ({ ids, total } = await spec.sqlPage(sqlSort(asc), skip, limit));
  } else {
    const rows = await spec.rows(sort);
    const kept = spec.keep ? rows.filter(spec.keep) : rows;
    kept.sort((a, b) => {
      const c = spec.compare(sort, a, b, filters.lang);
      return asc ? -c : c;
    });
    total = kept.length;
    ids = kept.slice(skip, skip + limit).map((row) => row.id);
  }

  const loaded = new Map((await spec.load(ids)).map((e) => [e.id, e]));
  return {
    items: ids.flatMap((id) => loaded.get(id) ?? []),
    total,
    hasMore: total > page * limit,
  };
}

/**
 * The order `rows` comes in and `sqlPage` breaks ties with — the id only to
 * make equal timestamps deterministic.
 */
export const RECENTLY_UPDATED_FIRST: [{ updatedAt: "desc" }, { id: "asc" }] = [
  { updatedAt: "desc" },
  { id: "asc" },
];

/**
 * A title search, matched literally and ignoring case — like the substring
 * match it replaced. Prisma hands `contains` to LIKE as is, so `%` and `_`
 * would otherwise be wildcards: "%" matched every title.
 */
export const titleContains = (q: string) => ({
  contains: q.replace(/[\\%_]/g, "\\$&"),
  mode: "insensitive" as const,
});

/** The search box's words, or nothing to filter on. */
export const searchTerm = (filters: ListEntriesFilters): string | undefined =>
  filters.q?.trim() || undefined;

/**
 * Loads an entry and refuses it unless it belongs to the caller. A missing
 * entry is a 404 and someone else's a 403 — never an implicit "track it for
 * them".
 */
export async function assertEntryOwnership<T extends { userId: string }>(
  userId: string,
  findEntry: () => Promise<T | null>,
): Promise<T> {
  const entry = await findEntry();

  if (!entry) {
    throw new AppException(
      HttpStatus.NOT_FOUND,
      ErrorCode.LibraryEntryNotFound,
    );
  }

  if (entry.userId !== userId) {
    throw new AppException(
      HttpStatus.FORBIDDEN,
      ErrorCode.LibraryEntryForbidden,
    );
  }

  return entry;
}

/**
 * Deletes one replay (rewatch, replay or reread) after checking it belongs to
 * the caller, and revokes the XP it earned.
 */
export async function deleteOwnedReplay(
  xp: XpService,
  args: {
    userId: string;
    replayId: string;
    /** `XpEntry.sourceType` for this domain's replay, e.g. "BookReplay". */
    xpSource: string;
    findOwnerId: () => Promise<string | null>;
    remove: () => Promise<unknown>;
  },
): Promise<void> {
  const ownerId = await args.findOwnerId();

  if (ownerId === null) {
    throw new AppException(
      HttpStatus.NOT_FOUND,
      ErrorCode.LibraryReplayNotFound,
    );
  }

  if (ownerId !== args.userId) {
    throw new AppException(
      HttpStatus.FORBIDDEN,
      ErrorCode.LibraryReplayForbidden,
    );
  }

  await args.remove();
  await xp.revokeBySource(args.xpSource, [args.replayId]);
}

/**
 * The Review/Comment cleanup an entry removal owes, returned as operations the
 * caller splices into its own `$transaction` next to the entry delete and any
 * domain extras. Both tables are polymorphic (`targetType`/`targetId`, no FK),
 * so nothing cascades for them at the DB level.
 *
 * `targetIds` is every id the entry covers: the work itself for books, games
 * and music, plus its seasons and episodes for media.
 */
export function polymorphicTargetCleanup(
  prisma: PrismaService,
  userId: string,
  targetIds: string[],
): Prisma.PrismaPromise<unknown>[] {
  return [
    prisma.review.deleteMany({
      where: { userId, targetId: { in: targetIds } },
    }),
    prisma.comment.updateMany({
      where: { authorId: userId, targetId: { in: targetIds }, deletedAt: null },
      data: { text: null, deletedAt: new Date() },
    }),
  ];
}
