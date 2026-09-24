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
 * matrix, the XP owed by a new entry, the in-memory list contract, and the
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

export interface EntryListSpec<T, K extends string> {
  sortKeys: readonly K[];
  defaultSort: K;
  /** Natural order per criterion; `order: "asc"` negates it. */
  compare: (sort: K, a: T, b: T, locale: string | undefined) => number;
  /** The field the `q` search matches on. */
  title: (entry: T) => string;
  /** Extra per-domain predicate — MEDIA filters on a derived status. */
  keep?: (entry: T) => boolean;
}

/**
 * The filter/sort/paginate tail every `listEntries` ends with, applied to the
 * DTOs rather than in SQL because progress and effective status are derived.
 * PRF-01 will attack this one place instead of four.
 */
export function paginateEntries<
  T extends { favorite: boolean },
  K extends string,
>(
  entries: T[],
  filters: ListEntriesFilters,
  spec: EntryListSpec<T, K>,
): PagedResult<T> {
  const q = filters.q?.trim().toLowerCase();
  const kept = entries.filter((entry) => {
    if (spec.keep && !spec.keep(entry)) return false;
    if (filters.favorite && !entry.favorite) return false;
    if (q && !spec.title(entry).toLowerCase().includes(q)) return false;
    return true;
  });

  const sort = spec.sortKeys.includes(filters.sort as K)
    ? (filters.sort as K)
    : spec.defaultSort;
  const asc = filters.order === "asc";
  kept.sort((a, b) => {
    const c = spec.compare(sort, a, b, filters.lang);
    return asc ? -c : c;
  });

  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const limit =
    filters.limit && filters.limit > 0 ? filters.limit : DEFAULT_PAGE_SIZE;
  const start = (page - 1) * limit;
  return {
    items: kept.slice(start, start + limit),
    total: kept.length,
    hasMore: kept.length > page * limit,
  };
}

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
