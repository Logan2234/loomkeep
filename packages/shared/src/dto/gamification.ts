/**
 * An unlocked achievement not yet shown to the user by the [G6] unlock-bubble
 * UI (`UserAchievement.displayedAt IS NULL`). `xpAwarded` is looked up from
 * the matching XpEntry (sourceType "UserAchievement", sourceId = this id)
 * rather than stored on `UserAchievement` itself — see the [G2] plan.
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
   * [G9] Whether this exact key is currently in the viewer's own showcase.
   * Always false for a masked secret (it can never be equipped — see
   * `MAX_EQUIPPED_BADGES`'s doc) and for anyone else's achievement list, since
   * `GET /achievements` only ever returns the viewer's own.
   */
  equipped: boolean;
}

/**
 * [G9] How many badges a showcase can hold at once. Shared so the API's
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

/** [G7] Which population a leaderboard ranks. */
export type LeaderboardScope = "global" | "friends";

/**
 * [G7] The window a leaderboard sums XP over — calendar month or calendar
 * year in the server's clock, recomputed live from the ledger rather than a
 * snapshot (see the ticket: no snapshot table needed for the MVP).
 */
export type LeaderboardPeriod = "month" | "year";

/**
 * [G7] One ranked row. Deliberately lean, not a `UserSummaryDto`: it carries
 * no `profileAccess`, so a PRIVATE row is never distinguishable from a
 * PUBLIC one — the leaderboard shows a pseudo and nothing else, ever.
 *
 * `level` is never sent — same rule as everywhere else in gamification: the
 * client derives it from `xp` via `levelProgress()`.
 *
 * `avatarUrl` is null (client falls back to the identicon) whenever the row
 * is a PRIVATE account the viewer isn't friends with, regardless of whether
 * they uploaded a real photo — see the [G7] plan for why this is a stricter
 * rule than the profile page (which shows a PRIVATE stranger's real avatar).
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
 * [G7] `entries` is capped at the top 100 (no pagination for the MVP).
 * `viewerOutsideTop` carries the viewer's own row only when it did NOT make
 * that cut — when it did, the viewer's row is already in `entries` (flagged
 * `isViewer`) and this is null, so the UI never shows both at once. Also
 * null when the viewer has zero XP for the period (not ranked yet).
 */
export interface LeaderboardDto {
  entries: LeaderboardEntryDto[];
  viewerOutsideTop: LeaderboardEntryDto | null;
}
