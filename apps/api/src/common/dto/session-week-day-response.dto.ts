import type { SessionWeekDayDto } from "@loomkeep/shared/contracts";

export class SessionWeekDayResponseDto implements SessionWeekDayDto {
  date!: string;
  durationMinutes!: number;
  sessionCount!: number;
}
