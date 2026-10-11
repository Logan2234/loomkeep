import type { ApiV1AchievementDto } from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
import { ApiV1AchievementProgressResponseDto } from "./api-v1-achievement-progress-response.dto";
export class ApiV1AchievementResponseDto implements ApiV1AchievementDto {
  /**
   * The achievement's key; null for a secret achievement not unlocked yet.
   * @example "episodes_watched_bronze"
   */
  key!: string | null;

  /**
   * The family it belongs to.
   * @example "episodes_watched"
   */
  family!: string;

  /**
   * Its tier within the family, if tiered.
   * @example "bronze"
   */
  tier!: string | null;

  /**
   * Whether the account has it.
   * @example true
   */
  unlocked!: boolean;

  /**
   * When it was unlocked.
   * @example "2026-09-30T21:00:00.000Z"
   */
  unlockedAt!: string | null;

  /** Progress towards it; null once unlocked or when it can't be measured. */
  @ApiProperty({ type: ApiV1AchievementProgressResponseDto, nullable: true })
  progress!: ApiV1AchievementProgressResponseDto | null;
}
