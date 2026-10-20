import type { SessionWeekDayDto } from "@loomkeep/shared";

export class SessionWeekDayResponseDto implements SessionWeekDayDto {
  date!: string;
  durationMinutes!: number;
  sessionCount!: number;
}
