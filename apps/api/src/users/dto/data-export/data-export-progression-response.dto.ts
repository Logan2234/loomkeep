import type { DataExportProgression } from "@loomkeep/shared";

class DataExportXpEntryResponseDto {
  /**
   * What earned it.
   * @example "REVIEW"
   */
  reason!: string;

  /**
   * XP earned (negative when taken back).
   * @example 20
   */
  amount!: number;

  /**
   * When it was earned.
   * @example "2026-09-30T21:00:00.000Z"
   */
  createdAt!: string;
}

class DataExportAchievementResponseDto {
  /**
   * The achievement.
   * @example "first_review"
   */
  key!: string;

  /**
   * When it was unlocked.
   * @example "2026-09-30T21:00:00.000Z"
   */
  unlockedAt!: string;
}

export class DataExportProgressionResponseDto implements DataExportProgression {
  /**
   * Total XP.
   * @example 1280
   */
  xp!: number;

  /** Every XP gain and loss. */
  xpEntries!: DataExportXpEntryResponseDto[];

  /** Achievements unlocked. */
  achievements!: DataExportAchievementResponseDto[];
}
