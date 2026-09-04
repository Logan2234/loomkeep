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
}

/**
 * The viewer's own progression total. `xp` is null when GAMIFICATION_ENABLED
 * is off. Served by the gamification module rather than the social profile,
 * so a SOCIAL_ENABLED=false instance still has levels ("solo first").
 */
export interface MyProgressionDto {
  xp: number | null;
}
