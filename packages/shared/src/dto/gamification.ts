import type { XpReason } from "../enums";

/**
 * An unlocked achievement not yet shown to the user by the unlock bubble
 * UI (`UserAchievement.displayedAt IS NULL`). `xpAwarded` is looked up from
 * the matching XpEntry (sourceType "UserAchievement", sourceId = this id)
 * rather than stored on `UserAchievement` itself.
 */
export interface PendingAchievementDto {
  id: string;
  key: string;
  unlockedAt: string;
  xpAwarded: number;
}

/**
 * Which section of the achievements screen an entry belongs to. "secret" is
 * deliberately NOT one of these — it is an orthogonal trait (`secret` below),
 * so a secret achievement still carries a real family and shows, masked, in
 * its own section.
 */
export type AchievementFamily =
  | "volume"
  | "ritual"
  | "exploration"
  | "completion"
  | "seasonal"
  | "social"
  | "account"
  | "misc";

/**
 * Explicit tier of one entry of a tiered family. Never derived by parsing a
 * key's suffix — the registry declares it.
 */
export type AchievementTier = "bronze" | "silver" | "gold";

/**
 * One registry entry projected for the current user (GET /achievements) —
 * every catalogue key, unlocked or not.
 *
 * A secret entry that is still locked is returned masked: `key`, `xpAward`,
 * `tierOf`, `tier` and `progress` are all null, leaving only `family` and
 * `secret`. The key alone would be enough to reveal the achievement, since
 * the web resolves names and descriptions from an i18n catalogue indexed by
 * it — so the masking has to happen server-side, not in the UI.
 */
export interface AchievementDto {
  key: string | null;
  family: AchievementFamily;
  tierOf: string | null;
  tier: AchievementTier | null;
  xpAward: number | null;
  secret: boolean;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: { current: number; target: number } | null;
  /**
   * Whether this exact key is currently in the viewer's own showcase.
   * Always false for a masked secret (it can never be equipped — see
   * `MAX_EQUIPPED_BADGES`'s doc) and for anyone else's achievement list, since
   * `GET /achievements` only ever returns the viewer's own.
   */
  equipped: boolean;
  /**
   * Share of active members holding it, from the last nightly count — shown
   * for a masked secret too. Null on an instance too small for a share to
   * mean anything.
   */
  rarity: AchievementRarityDto | null;
}

/**
 * `percent` is exact, unless `upperBound`: then only "under `percent` %" is
 * said, because so few members hold it that the exact share would point at
 * who they are.
 */
export interface AchievementRarityDto {
  percent: number;
  upperBound: boolean;
}

/**
 * How many badges a showcase can hold at once. Shared so the API's
 * validation and the web's "equip" button disabled-state agree on the same
 * number without either hardcoding it.
 */
export const MAX_EQUIPPED_BADGES = 3;

/**
 * The viewer's own progression total. `xp` is null when GAMIFICATION_ENABLED
 * is off. Served by the gamification module rather than the social profile,
 * so a SOCIAL_ENABLED=false instance still has levels ("solo first").
 */
export interface MyProgressionDto {
  xp: number | null;
}

/**
 * What earned (or took back) one XP line, snapshotted at grant time — the
 * source row is often gone by the time a revoked line is read. `title` is
 * null for a reason with no work behind it (profile, admin adjustment…).
 */
export interface XpHistoryItemDto {
  reason: XpReason;
  /** A loss taking back an earlier gain, rather than the gain itself. */
  revoked: boolean;
  /** Signed: a revocation shows the gain it takes back, negated. */
  amount: number;
  /** When this happened: the gain, or for a revocation, the revocation. */
  at: string;
  /** For a gain later taken back, when; for a revocation, null. */
  revokedAt: string | null;
  /** For a revocation, when the gain it takes back was earned. */
  earnedAt: string | null;
  title: string | null;
  /** Null when there is nothing left to open (a deleted list). */
  href: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  /** ACHIEVEMENT_UNLOCKED's achievement — a tiered one's family — for the web to name it. */
  achievementKey: string | null;
  /** DOMAIN_STARTED / IMPORT_COMPLETED's domain. */
  domain: string | null;
  /** READING_GOAL_REACHED's goal: how many books, which year. */
  goalTarget: number | null;
  goalYear: number | null;
}

/** One local day (the viewer's timezone) of the XP ledger. */
export interface XpHistoryDayDto {
  /** "YYYY-MM-DD". */
  day: string;
  /** Signed sum of `items`. */
  net: number;
  /** Most recent first. */
  items: XpHistoryItemDto[];
}

export type LeaderboardScope = "global" | "friends";

/**
 * Calendar window a leaderboard sums live from the XP ledger, using the
 * server's clock rather than a snapshot table — or `all`, every XP ever
 * earned, read from the materialised total instead.
 */
export type LeaderboardPeriod = "month" | "year" | "all";

/**
 * Deliberately lean, not a `UserSummaryDto`: it carries
 * no `profileAccess`, so a PRIVATE row is never distinguishable from a
 * PUBLIC one — the leaderboard shows a pseudo and nothing else, ever.
 *
 * `level` is never sent — same rule as everywhere else in gamification: the
 * client derives it from `xp` via `levelProgress()`.
 *
 * `avatarUrl` is null (client falls back to the identicon) whenever the row
 * is a PRIVATE account the viewer isn't friends with, regardless of whether
 * they uploaded a real photo. This is stricter than the profile page, which
 * shows a PRIVATE stranger's real avatar.
 *
 * `rank` follows SQL `RANK()` semantics: tied rows share the same number and
 * the next distinct rank skips ahead by the tie's size (1, 2, 2, 4 — not
 * 1, 2, 2, 3). The UI shows the number only on the first of a tied group (by
 * account age) and a dash on the rest — recomputed client-side by comparing
 * consecutive entries, not carried as a field.
 */
export interface LeaderboardEntryDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  xp: number;
  rank: number;
  isViewer: boolean;
}

/**
 * `entries` is capped at the top 100 without pagination.
 * `viewerOutsideTop` carries the viewer's own row only when it did NOT make
 * that cut — when it did, the viewer's row is already in `entries` (flagged
 * `isViewer`) and this is null, so the UI never shows both at once. Also
 * null when the viewer has zero XP for the period (not ranked yet).
 */
export interface LeaderboardDto {
  entries: LeaderboardEntryDto[];
  viewerOutsideTop: LeaderboardEntryDto | null;
}
