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
