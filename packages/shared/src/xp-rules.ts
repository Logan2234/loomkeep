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
 * an admin) and ACHIEVEMENT_UNLOCKED (varies by achievement tier) — both
 * pass `XpService.award`'s `amountOverride` instead of a fixed value here.
 */
export interface XpRule {
  reason: XpReason;
  amount?: number;
  sourceType: string;
  dailyCap?: number;
  socialGated: boolean;
}

// Reference unit: one episode watched = 10 XP. See the [G1] plan for the
// full rationale behind each amount/cap pair.
export const XP_RULES: Record<XpReason, XpRule> = {
  // --- Consumption — the only group that lives without SOCIAL_ENABLED. ---
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
    amount: 200,
    sourceType: "GameEntry",
    dailyCap: 3,
    socialGated: false,
  },
  GAME_REPLAYED: {
    reason: XpReason.GAME_REPLAYED,
    amount: 50,
    sourceType: "GameReplay",
    dailyCap: 3,
    socialGated: false,
  },
  BOOK_FINISHED: {
    reason: XpReason.BOOK_FINISHED,
    amount: 150,
    sourceType: "BookEntry",
    dailyCap: 3,
    socialGated: false,
  },
  BOOK_REPLAYED: {
    reason: XpReason.BOOK_REPLAYED,
    amount: 50,
    sourceType: "BookReplay",
    dailyCap: 3,
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

  // --- Rating & critique. ---
  WORK_RATED: {
    reason: XpReason.WORK_RATED,
    amount: 10,
    sourceType: "Review",
    dailyCap: 20,
    socialGated: false,
  },
  REVIEW_WRITTEN: {
    reason: XpReason.REVIEW_WRITTEN,
    amount: 30,
    sourceType: "Review",
    dailyCap: 20,
    socialGated: false,
  },
  REVIEW_DETAILED: {
    reason: XpReason.REVIEW_DETAILED,
    amount: 30,
    sourceType: "Review",
    dailyCap: 20,
    socialGated: false,
  },

  // --- Discussion — SOCIAL_ENABLED only. ---
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

  // --- Milestones. ---
  IMPORT_COMPLETED: {
    reason: XpReason.IMPORT_COMPLETED,
    amount: 150,
    // Same synthetic-source shape as DOMAIN_STARTED: one forfeit per domain,
    // deduped by the unique constraint, not a dailyCap.
    sourceType: "DOMAIN",
    socialGated: false,
  },
  // Reserved for G8 — no caller in this ticket (see the enum's doc comment).
  // Unique per step key (each onboarding step is only ever completed once),
  // so no dailyCap — same reasoning as DOMAIN_STARTED above.
  ONBOARDING_STEP: {
    reason: XpReason.ONBOARDING_STEP,
    amount: 20,
    sourceType: "OnboardingStep",
    socialGated: false,
  },
  // Reserved — no caller in this ticket. Unique per user (sourceId = the
  // user's own id), so no dailyCap.
  PROFILE_COMPLETED: {
    reason: XpReason.PROFILE_COMPLETED,
    amount: 50,
    sourceType: "User",
    socialGated: false,
  },
  // [G2]: amount varies by achievement tier — like ADMIN_ADJUSTMENT below,
  // no fixed `amount` here. AchievementService always passes
  // XpService.award's `amountOverride` (the definition's own `xpAward`)
  // instead. Unique per achievement id, so no dailyCap.
  ACHIEVEMENT_UNLOCKED: {
    reason: XpReason.ACHIEVEMENT_UNLOCKED,
    sourceType: "UserAchievement",
    socialGated: false,
  },
  // Reserved for B8 — no caller in this ticket. No fixed `amount` (a signed,
  // per-grant value chosen by an admin) and never revoked (excluded from
  // reconciliation explicitly, not just "no verifier").
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
