import type { PendingAchievementDto } from "@loomkeep/shared";

export class PendingAchievementResponseDto implements PendingAchievementDto {
  id!: string;
  key!: string;
  unlockedAt!: string;
  xpAwarded!: number;
}
