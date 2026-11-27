import type { ProfileActivityStatsDto } from "@loomkeep/shared/contracts";

export class ProfileActivityStatsResponseDto implements ProfileActivityStatsDto {
  visible!: boolean;
  streakDays!: number;
  streakSecuredToday!: boolean;
}
