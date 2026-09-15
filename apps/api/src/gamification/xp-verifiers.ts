import {
  BookStatus,
  GameStatus,
  MusicStatus,
  ReviewVoteValue,
  XpReason,
} from "@loomkeep/shared";
import { isAiringFinished } from "../catalog/airing-status.util";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * One check per XpReason: do the source rows the XpEntries point at still
 * justify their credit? Called only by `XpService.reconcile` — `award()`
 * trusts its caller; only the nightly sweep re-derives truth from the data.
 * Each verifier takes the whole batch and answers for all of it at once.
 *
 * `ADMIN_ADJUSTMENT` and `PROFILE_COMPLETED` deliberately have no entry:
 * both are acquired for good once credited (see the [G1] plan for
 * ADMIN_ADJUSTMENT; PROFILE_COMPLETED is a one-off milestone that never
 * un-happens even if the bio/avatar is cleared later), so
 * `XpService.reconcile` excludes them from the loop entirely rather than
 * mapping them to an always-true verifier.
 */
/** One ledger row, as the reconciliation sweep hands it to a verifier. */
export interface XpEntryRef {
  /** The XpEntry's own id — what the verifier returns to keep. */
  id: string;
  sourceId: string;
  userId: string;
}

/**
 * Checks a whole batch at once and returns the ids of the entries that are
 * still justified. Batched rather than per-row because the sweep walks the
 * entire ledger every night: one query per row meant a round-trip per XpEntry
 * per reason, which is three orders of magnitude more than the work requires.
 *
 * Returns entry ids, not source ids: SEASON_COMPLETED and SERIES_COMPLETED
 * are per-user, so the same source can be valid for one user and stale for
 * another.
 */
export type XpVerifier = (
  prisma: PrismaService,
  entries: XpEntryRef[],
) => Promise<Set<string>>;

/**
 * Builds a verifier that answers from one query over one table: load the rows
 * whose id is in the batch, keep the entries whose source survived `isValid`.
 */
function byExistingRow<T extends { id: string }>(
  load: (prisma: PrismaService, ids: string[]) => Promise<T[]>,
  isValid: (row: T) => boolean = () => true,
): XpVerifier {
  return async (prisma, entries) => {
    const ids = [...new Set(entries.map((e) => e.sourceId))];
    if (ids.length === 0) return new Set();

    const rows = await load(prisma, ids);
    const validSources = new Set(rows.filter(isValid).map((row) => row.id));

    return new Set(
      entries.filter((e) => validSources.has(e.sourceId)).map((e) => e.id),
    );
  };
}

/**
 * For the reasons that can never go stale (synthetic or one-way sources) —
 * see the per-entry comments below for why each one qualifies.
 */
const ALWAYS_VALID: XpVerifier = (_prisma, entries) =>
  Promise.resolve(new Set(entries.map((e) => e.id)));

/**
 * The two per-user checks: "has *this* user watched every aired episode" can
 * differ between two entries pointing at the same season, so these stay one
 * query set per entry. Two reasons out of twenty-one, and the only ones the
 * batching above cannot express.
 */
function perUser(
  check: (
    prisma: PrismaService,
    userId: string,
    sourceId: string,
  ) => Promise<boolean>,
): XpVerifier {
  return async (prisma, entries) => {
    const valid = new Set<string>();

    for (const entry of entries) {
      if (await check(prisma, entry.userId, entry.sourceId))
        valid.add(entry.id);
    }

    return valid;
  };
}

/**
 * Word count used by both the reconciliation verifiers below and the live
 * award sites (review.service.ts) — a single implementation so the two can
 * never silently disagree on the REVIEW_WRITTEN/REVIEW_DETAILED thresholds.
 */
export function wordCount(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * True only if every already-aired episode among `episodes` has at least one
 * watch by `userId` — the shared core of the SEASON_COMPLETED/
 * SERIES_COMPLETED checks below. Mirrors `LibraryService.computeProgress`'s
 * notion of "done" without depending on LibraryService itself (importing it
 * here would create a module cycle: LibraryModule already imports
 * GamificationModule for XpService).
 */
async function allAiredEpisodesWatched(
  prisma: PrismaService,
  userId: string,
  episodes: { id: string; airDate: Date | null }[],
): Promise<boolean> {
  const now = new Date();
  const aired = episodes.filter((e) => !e.airDate || e.airDate <= now);
  // No aired episodes at all isn't a valid "completed" state to have been
  // credited for in the first place.
  if (aired.length === 0) return false;

  const watched = await prisma.episodeWatch.findMany({
    where: { userId, episodeId: { in: aired.map((e) => e.id) } },
    distinct: ["episodeId"],
    select: { episodeId: true },
  });
  const watchedIds = new Set(watched.map((w) => w.episodeId));
  return aired.every((e) => watchedIds.has(e.id));
}

/**
 * Whether `seasonId` is complete for `userId` — the same check the
 * SEASON_COMPLETED verifier below runs during nightly reconciliation,
 * exported so `LibraryService` can award/revoke it live right after a watch
 * change without duplicating the "what counts as complete" rule.
 */
export async function isSeasonComplete(
  prisma: PrismaService,
  userId: string,
  seasonId: string,
): Promise<boolean> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { number: true, episodes: { select: { id: true, airDate: true } } },
  });
  // Season 0 (specials) is excluded from progress everywhere else in the
  // app (see LibraryService.computeProgress) — never a valid completion.
  if (!season || season.number === 0) return false;
  return allAiredEpisodesWatched(prisma, userId, season.episodes);
}

/**
 * Whether the whole series behind `libraryEntryId` is complete for `userId`
 * — see `isSeasonComplete` above for why this is shared rather than
 * reimplemented at the live award site.
 */
export async function isSeriesComplete(
  prisma: PrismaService,
  userId: string,
  libraryEntryId: string,
): Promise<boolean> {
  const entry = await prisma.libraryEntry.findUnique({
    where: { id: libraryEntryId },
    select: { mediaItemId: true, mediaItem: { select: { status: true } } },
  });
  if (!entry || !isAiringFinished(entry.mediaItem.status)) return false;

  const seasons = await prisma.season.findMany({
    where: { mediaItemId: entry.mediaItemId, number: { gt: 0 } },
    select: { episodes: { select: { id: true, airDate: true } } },
  });
  return allAiredEpisodesWatched(
    prisma,
    userId,
    seasons.flatMap((s) => s.episodes),
  );
}

export const XP_VERIFIERS: Partial<Record<XpReason, XpVerifier>> = {
  EPISODE_WATCHED: byExistingRow((prisma, ids) =>
    prisma.episodeWatch.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    }),
  ),

  MOVIE_WATCHED: byExistingRow(
    (prisma, ids) =>
      prisma.libraryEntry.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true },
      }),
    (entry) => entry.status === "COMPLETED",
  ),

  MOVIE_REPLAYED: byExistingRow((prisma, ids) =>
    prisma.movieReplay.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    }),
  ),

  SEASON_COMPLETED: perUser(isSeasonComplete),

  SERIES_COMPLETED: perUser(isSeriesComplete),

  GAME_FINISHED: byExistingRow(
    (prisma, ids) =>
      prisma.gameEntry.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true },
      }),
    (entry) => entry.status === GameStatus.COMPLETED,
  ),

  GAME_REPLAYED: byExistingRow((prisma, ids) =>
    prisma.gameReplay.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    }),
  ),

  BOOK_FINISHED: byExistingRow(
    (prisma, ids) =>
      prisma.bookEntry.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true },
      }),
    (entry) => entry.status === BookStatus.READ,
  ),

  BOOK_REPLAYED: byExistingRow((prisma, ids) =>
    prisma.bookReplay.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    }),
  ),

  ALBUM_LISTENED: byExistingRow(
    (prisma, ids) =>
      prisma.musicEntry.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true },
      }),
    (entry) => entry.status === MusicStatus.LISTENED,
  ),

  // Not wired to any caller in this ticket (G1b). `sourceType` is the
  // domain-agnostic "Entry" (see xp-rules.ts) — the id is a cuid, globally
  // unique across tables, so checking all four is unambiguous. Four queries
  // per batch, not four per row.
  WORK_ADDED: async (prisma, entries) => {
    const ids = [...new Set(entries.map((e) => e.sourceId))];
    if (ids.length === 0) return new Set();

    const where = { id: { in: ids } };
    const select = { id: true };
    const found = await Promise.all([
      prisma.libraryEntry.findMany({ where, select }),
      prisma.gameEntry.findMany({ where, select }),
      prisma.bookEntry.findMany({ where, select }),
      prisma.musicEntry.findMany({ where, select }),
    ]);
    const validSources = new Set(found.flat().map((row) => row.id));

    return new Set(
      entries.filter((e) => validSources.has(e.sourceId)).map((e) => e.id),
    );
  },

  // Synthetic, domain-scoped sources (sourceId is a domain name, not a real
  // row id) — never revoked by design (see the [G1] plan), so there is
  // nothing that can go stale.
  DOMAIN_STARTED: ALWAYS_VALID,
  IMPORT_COMPLETED: ALWAYS_VALID,

  WORK_RATED: byExistingRow((prisma, ids) =>
    prisma.review.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    }),
  ),

  REVIEW_WRITTEN: byExistingRow(
    (prisma, ids) =>
      prisma.review.findMany({
        where: { id: { in: ids } },
        select: { id: true, text: true },
      }),
    (review) => wordCount(review.text) >= 40,
  ),

  REVIEW_DETAILED: byExistingRow(
    (prisma, ids) =>
      prisma.review.findMany({
        where: { id: { in: ids } },
        select: { id: true, text: true },
      }),
    (review) => wordCount(review.text) >= 150,
  ),

  // Comment.deletedAt is set by soft-delete — an existing-but-tombstoned row
  // must not keep justifying its XP (see the [G1] plan's edge cases).
  COMMENT_POSTED: byExistingRow(
    (prisma, ids) =>
      prisma.comment.findMany({
        where: { id: { in: ids } },
        select: { id: true, deletedAt: true, text: true },
      }),
    (comment) =>
      comment.deletedAt === null && (comment.text?.trim().length ?? 0) >= 15,
  ),

  // An upsert can flip UP -> DOWN in place, so existence alone isn't enough.
  REVIEW_VOTE_RECEIVED: byExistingRow(
    (prisma, ids) =>
      prisma.reviewVote.findMany({
        where: { id: { in: ids } },
        select: { id: true, value: true },
      }),
    (vote) => vote.value === ReviewVoteValue.UP,
  ),

  COMMENT_REACTION_RECEIVED: byExistingRow((prisma, ids) =>
    prisma.commentReaction.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    }),
  ),

  LIST_CREATED: byExistingRow((prisma, ids) =>
    prisma.list.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    }),
  ),

  // An unlocked achievement is never taken back, so there is nothing to
  // re-derive here — the entry stays valid for as long as it exists.
  ACHIEVEMENT_UNLOCKED: ALWAYS_VALID,

  // ADMIN_ADJUSTMENT and PROFILE_COMPLETED deliberately omitted — see the
  // doc comment above.
};
