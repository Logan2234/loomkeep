import type { CalendarTokenDto } from "@loomkeep/shared/contracts";

export class CalendarTokenResponseDto implements CalendarTokenDto {
  token!: string;
}
