import type { ProfileActivityStatsDto } from "@loomkeep/shared";

export class ProfileActivityStatsResponseDto implements ProfileActivityStatsDto {
  visible!: boolean;
  streakDays!: number;
  streakSecuredToday!: boolean;
}
