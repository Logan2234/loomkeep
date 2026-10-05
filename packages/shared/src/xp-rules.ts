import { XpReason } from "./enums";

/**
 * One barème row: the XP a reason grants, the daily cap that bounds farming
 * it, the table its `XpEntry.sourceId` points into, and whether it only
 * applies when SOCIAL_ENABLED is on. Pure data, no Prisma — consumed by the
 * API's `XpService` (crediting) and reconciliation job, and by the web for
 * any "how do I earn XP" copy.
 *
 * `dailyCap` is omitted only for a reason that is inherently unique by
 * nature (a one-off milestone, e.g. DOMAIN_STARTED) — every repeatable
 * reason carries one, calibrated to what's physically plausible in a day.
 * `amount` is omitted only for ADMIN_ADJUSTMENT (signed, chosen per grant by
 * an admin), ACHIEVEMENT_UNLOCKED (varies by achievement tier) and the
 * progressive SAGA_COMPLETED / READING_GOAL_REACHED (sized by the saga or the
 * goal) — all pass `XpService.award`'s `amountOverride` instead.
 */
export interface XpRule {
  reason: XpReason;
  amount?: number;
  sourceType: string;
  dailyCap?: number;
  socialGated: boolean;
}

// Reference unit: one episode watched = 10 XP.
export const XP_RULES: Record<XpReason, XpRule> = {
  // Consumption is the only group available without SOCIAL_ENABLED.
  EPISODE_WATCHED: {
    reason: XpReason.EPISODE_WATCHED,
    amount: 10,
    sourceType: "EpisodeWatch",
    dailyCap: 30,
    socialGated: false,
  },
  MOVIE_WATCHED: {
    reason: XpReason.MOVIE_WATCHED,
    amount: 50,
    sourceType: "LibraryEntry",
    dailyCap: 10,
    socialGated: false,
  },
  MOVIE_REPLAYED: {
    reason: XpReason.MOVIE_REPLAYED,
    amount: 25,
    sourceType: "MovieReplay",
    dailyCap: 5,
    socialGated: false,
  },
  SEASON_COMPLETED: {
    reason: XpReason.SEASON_COMPLETED,
    amount: 30,
    sourceType: "Season",
    dailyCap: 5,
    socialGated: false,
  },
  SERIES_COMPLETED: {
    reason: XpReason.SERIES_COMPLETED,
    amount: 100,
    sourceType: "LibraryEntry",
    dailyCap: 3,
    socialGated: false,
  },
  GAME_FINISHED: {
    reason: XpReason.GAME_FINISHED,
    // A game takes tens of hours where a book takes a few: paid more than
    // BOOK_FINISHED so an hour played is worth about an hour read.
    amount: 350,
    // The first playthrough: un-finishing the game revokes that cycle.
    sourceType: "GamePlaythrough",
    dailyCap: 3,
    socialGated: false,
  },
  GAME_REPLAYED: {
    reason: XpReason.GAME_REPLAYED,
    amount: 100,
    sourceType: "GamePlaythrough",
    dailyCap: 3,
    socialGated: false,
  },
  BOOK_FINISHED: {
    reason: XpReason.BOOK_FINISHED,
    amount: 150,
    // The first reading: un-finishing the book revokes that cycle.
    sourceType: "BookReading",
    dailyCap: 3,
    socialGated: false,
  },
  BOOK_REPLAYED: {
    reason: XpReason.BOOK_REPLAYED,
    amount: 50,
    sourceType: "BookReading",
    dailyCap: 3,
    socialGated: false,
  },
  SESSION_DAY_LOGGED: {
    reason: XpReason.SESSION_DAY_LOGGED,
    amount: 10,
    sourceType: "SESSION_DAY",
    // One shared reward across game and book sessions per local day.
    dailyCap: 1,
    socialGated: false,
  },
  ALBUM_LISTENED: {
    reason: XpReason.ALBUM_LISTENED,
    amount: 20,
    sourceType: "MusicEntry",
    dailyCap: 10,
    socialGated: false,
  },
  WORK_ADDED: {
    reason: XpReason.WORK_ADDED,
    amount: 2,
    // Domain-agnostic on purpose: whichever entry table the caller adds to
    // (LibraryEntry/GameEntry/BookEntry/MusicEntry) uses this same reason.
    sourceType: "Entry",
    dailyCap: 25,
    socialGated: false,
  },
  DOMAIN_STARTED: {
    reason: XpReason.DOMAIN_STARTED,
    amount: 100,
    // Synthetic source: one row per (userId, domain), not anchored to a
    // real table — see the schema's note on non-nullable sourceType/sourceId.
    sourceType: "DOMAIN",
    // Unique per domain (dedup relies on the XpEntry unique constraint, not
    // a cap), so no dailyCap here.
    socialGated: false,
  },

  WORK_RATED: {
    reason: XpReason.WORK_RATED,
    // A rating takes a second: worth half an episode, ten a day.
    amount: 5,
    sourceType: "Review",
    dailyCap: 10,
    socialGated: false,
  },
  REVIEW_WRITTEN: {
    reason: XpReason.REVIEW_WRITTEN,
    amount: 30,
    sourceType: "Review",
    // Five reviews a day is a prolific critic; more is filler.
    dailyCap: 5,
    socialGated: false,
  },
  REVIEW_DETAILED: {
    reason: XpReason.REVIEW_DETAILED,
    amount: 30,
    sourceType: "Review",
    dailyCap: 5,
    socialGated: false,
  },

  COMMENT_POSTED: {
    reason: XpReason.COMMENT_POSTED,
    amount: 10,
    sourceType: "Comment",
    dailyCap: 5,
    socialGated: true,
  },
  REVIEW_VOTE_RECEIVED: {
    reason: XpReason.REVIEW_VOTE_RECEIVED,
    amount: 5,
    sourceType: "ReviewVote",
    dailyCap: 50,
    socialGated: true,
  },
  COMMENT_REACTION_RECEIVED: {
    reason: XpReason.COMMENT_REACTION_RECEIVED,
    amount: 2,
    sourceType: "CommentReaction",
    dailyCap: 50,
    socialGated: true,
  },
  LIST_CREATED: {
    reason: XpReason.LIST_CREATED,
    amount: 10,
    sourceType: "List",
    dailyCap: 3,
    socialGated: true,
  },

  // Every released work of a saga seen, nothing announced. The amount grows
  // with the saga (sagaCompletionXp); once per saga, so no dailyCap — the
  // number of sagas bounds it.
  SAGA_COMPLETED: {
    reason: XpReason.SAGA_COMPLETED,
    sourceType: "Saga",
    socialGated: false,
  },
  // The year's reading goal met; the amount grows with the goal
  // (readingGoalXp). Once per goal, i.e. per year.
  READING_GOAL_REACHED: {
    reason: XpReason.READING_GOAL_REACHED,
    sourceType: "ReadingGoal",
    socialGated: false,
  },

  IMPORT_COMPLETED: {
    reason: XpReason.IMPORT_COMPLETED,
    amount: 150,
    // Same synthetic-source shape as DOMAIN_STARTED: one forfeit per domain,
    // deduped by the unique constraint, not a dailyCap.
    sourceType: "DOMAIN",
    socialGated: false,
  },
  // Credited once the user has set both a bio and an avatar (see
  // UsersService.uploadAvatar/updateMe). Unique per user (sourceId = the
  // user's own id), so no dailyCap.
  PROFILE_COMPLETED: {
    reason: XpReason.PROFILE_COMPLETED,
    amount: 50,
    sourceType: "User",
    socialGated: false,
  },
  // AchievementService supplies the tier's `xpAward` through amountOverride.
  // The achievement id provides uniqueness, so no dailyCap is needed.
  ACHIEVEMENT_UNLOCKED: {
    reason: XpReason.ACHIEVEMENT_UNLOCKED,
    sourceType: "UserAchievement",
    socialGated: false,
  },
  // A signed per-grant value chosen by an admin; never reconciled or revoked.
  ADMIN_ADJUSTMENT: {
    reason: XpReason.ADMIN_ADJUSTMENT,
    sourceType: "AdminAdjustment",
    socialGated: false,
  },
};

/**
 * `XP_RULES` as an array, for iteration (registries, reconciliation, tests).
 * @public No current caller — kept for whoever needs to iterate every rule
 * (e.g. a future admin page listing the barème, or a reconciliation script).
 * Flagged as unused by knip otherwise; this tag is a standing call to keep
 * it, not delete it.
 */
export const XP_RULE_LIST: XpRule[] = Object.values(XP_RULES);

/**
 * SAGA_COMPLETED's amount for a saga of `works` released works: grows faster
 * than the saga, so finishing a long one pays more per work than a diptych
 * (2 → 60, 3 → 105, 8 → 480), capped for the 40-volume series.
 */
export function sagaCompletionXp(works: number): number {
  return Math.min(1000, 5 * works * works + 20 * works);
}

/** Smallest reading goal that earns READING_GOAL_REACHED. */
export const MIN_REWARDED_READING_GOAL = 3;

/**
 * READING_GOAL_REACHED's amount for a goal of `books`: grows faster than the
 * goal (3 → 72, 12 → 612), capped at 20 books.
 */
export function readingGoalXp(books: number): number {
  return Math.min(1500, 3 * books * books + 15 * books);
}
