import type { Domain, SessionTimerDto } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

export class SessionTimerResponseDto implements SessionTimerDto {
  id!: string;

  @ApiProperty({ enum: ["GAMES", "BOOKS"] })
  domain!: Extract<Domain, "GAMES" | "BOOKS">;

  entryId!: string;
  startedAt!: string;
  pausedAt!: string | null;
  elapsedSeconds!: number;
}
