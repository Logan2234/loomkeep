import type { PendingAchievementDto } from "@loomkeep/shared/contracts";

export class PendingAchievementResponseDto implements PendingAchievementDto {
  id!: string;
  key!: string;
  unlockedAt!: string;
  xpAwarded!: number;
}
