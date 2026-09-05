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
 * One check per XpReason: does the source row an XpEntry points at still
 * justify the credit? Called only by `XpService.reconcile` — `award()`
 * trusts its caller; only the nightly sweep re-derives truth from the data.
 * Takes `userId` alongside `sourceId` (not just `sourceId` as the plan's
 * sketch suggests) because a couple of checks — SEASON_COMPLETED,
 * SERIES_COMPLETED — are inherently per-user ("has *this* user watched every
 * aired episode"), and the reconciliation loop already has the entry's
 * `userId` on hand for every row it checks.
 *
 * `ADMIN_ADJUSTMENT` deliberately has no entry: it's never revoked (see the
 * [G1] plan), so `XpService.reconcile` excludes it from the loop entirely
 * rather than mapping it to an always-true verifier.
 */
export type XpVerifier = (
  prisma: PrismaService,
  sourceId: string,
  userId: string,
) => Promise<boolean>;

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
  EPISODE_WATCHED: async (prisma, sourceId) =>
    (await prisma.episodeWatch.findUnique({ where: { id: sourceId } })) !==
    null,

  MOVIE_WATCHED: async (prisma, sourceId) => {
    const entry = await prisma.libraryEntry.findUnique({
      where: { id: sourceId },
      select: { status: true },
    });
    return entry?.status === "COMPLETED";
  },

  MOVIE_REPLAYED: async (prisma, sourceId) =>
    (await prisma.movieReplay.findUnique({ where: { id: sourceId } })) !== null,

  SEASON_COMPLETED: async (prisma, sourceId, userId) =>
    isSeasonComplete(prisma, userId, sourceId),

  SERIES_COMPLETED: async (prisma, sourceId, userId) =>
    isSeriesComplete(prisma, userId, sourceId),

  GAME_FINISHED: async (prisma, sourceId) => {
    const entry = await prisma.gameEntry.findUnique({
      where: { id: sourceId },
      select: { status: true },
    });
    return entry?.status === GameStatus.COMPLETED;
  },

  GAME_REPLAYED: async (prisma, sourceId) =>
    (await prisma.gameReplay.findUnique({ where: { id: sourceId } })) !== null,

  BOOK_FINISHED: async (prisma, sourceId) => {
    const entry = await prisma.bookEntry.findUnique({
      where: { id: sourceId },
      select: { status: true },
    });
    return entry?.status === BookStatus.READ;
  },

  BOOK_REPLAYED: async (prisma, sourceId) =>
    (await prisma.bookReplay.findUnique({ where: { id: sourceId } })) !== null,

  ALBUM_LISTENED: async (prisma, sourceId) => {
    const entry = await prisma.musicEntry.findUnique({
      where: { id: sourceId },
      select: { status: true },
    });
    return entry?.status === MusicStatus.LISTENED;
  },

  // Not wired to any caller in this ticket (G1b). `sourceType` is the
  // domain-agnostic "Entry" (see xp-rules.ts) — the id is a cuid, globally
  // unique across tables, so checking all four is unambiguous.
  WORK_ADDED: async (prisma, sourceId) => {
    const [lib, game, book, music] = await Promise.all([
      prisma.libraryEntry.findUnique({
        where: { id: sourceId },
        select: { id: true },
      }),
      prisma.gameEntry.findUnique({
        where: { id: sourceId },
        select: { id: true },
      }),
      prisma.bookEntry.findUnique({
        where: { id: sourceId },
        select: { id: true },
      }),
      prisma.musicEntry.findUnique({
        where: { id: sourceId },
        select: { id: true },
      }),
    ]);
    return !!(lib || game || book || music);
  },

  // Synthetic, domain-scoped sources (sourceId is a domain name, not a real
  // row id) — never revoked by design (see the [G1] plan), so there is
  // nothing that can go stale.
  DOMAIN_STARTED: async () => true,
  IMPORT_COMPLETED: async () => true,

  WORK_RATED: async (prisma, sourceId) =>
    (await prisma.review.findUnique({ where: { id: sourceId } })) !== null,

  REVIEW_WRITTEN: async (prisma, sourceId) => {
    const review = await prisma.review.findUnique({
      where: { id: sourceId },
      select: { text: true },
    });
    return wordCount(review?.text) >= 40;
  },

  REVIEW_DETAILED: async (prisma, sourceId) => {
    const review = await prisma.review.findUnique({
      where: { id: sourceId },
      select: { text: true },
    });
    return wordCount(review?.text) >= 150;
  },

  // Comment.deletedAt is set by soft-delete — an existing-but-tombstoned row
  // must not keep justifying its XP (see the [G1] plan's edge cases).
  COMMENT_POSTED: async (prisma, sourceId) => {
    const comment = await prisma.comment.findUnique({
      where: { id: sourceId },
      select: { deletedAt: true, text: true },
    });
    return (
      !!comment &&
      comment.deletedAt === null &&
      (comment.text?.trim().length ?? 0) >= 15
    );
  },

  // An upsert can flip UP -> DOWN in place, so existence alone isn't enough.
  REVIEW_VOTE_RECEIVED: async (prisma, sourceId) => {
    const vote = await prisma.reviewVote.findUnique({
      where: { id: sourceId },
      select: { value: true },
    });
    return vote?.value === ReviewVoteValue.UP;
  },

  COMMENT_REACTION_RECEIVED: async (prisma, sourceId) =>
    (await prisma.commentReaction.findUnique({ where: { id: sourceId } })) !==
    null,

  LIST_CREATED: async (prisma, sourceId) =>
    (await prisma.list.findUnique({ where: { id: sourceId } })) !== null,

  // Reserved, no caller in this ticket — see xp-rules.ts. `sourceId` is the
  // user's own id, which only ever disappears alongside the XpEntry itself
  // (onDelete: Cascade), so this check is really just future-proofing.
  PROFILE_COMPLETED: async (prisma, sourceId) =>
    (await prisma.user.findUnique({ where: { id: sourceId } })) !== null,

  // Reserved, no caller and no backing table yet (ONBOARDING_STEP: G8 hasn't
  // built step tracking; ACHIEVEMENT_UNLOCKED: G2 hasn't created
  // UserAchievement). Always valid until the owning ticket adds a real
  // check — inert today since nothing creates these entries.
  ONBOARDING_STEP: async () => true,
  ACHIEVEMENT_UNLOCKED: async () => true,

  // ADMIN_ADJUSTMENT deliberately omitted — see the doc comment above.
};
