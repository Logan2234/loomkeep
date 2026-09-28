import type {
  GameSessionDto,
  GameSessionMutationDto,
  GameSessionSummaryDto,
  SessionSource,
} from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";
import { SessionWeekDayResponseDto } from "../../common/dto/session-week-day-response.dto";

export class GameSessionResponseDto implements GameSessionDto {
  id!: string;
  durationMinutes!: number;
  notes!: string | null;
  occurredAt!: string;
  source!: SessionSource;
  createdAt!: string;
  updatedAt!: string;
}

export class GameSessionSummaryResponseDto implements GameSessionSummaryDto {
  @ApiProperty({ type: GameSessionResponseDto, isArray: true })
  items!: GameSessionResponseDto[];

  hasMore!: boolean;
  totalSessions!: number;
  totalTrackedMinutes!: number;
  weekMinutes!: number;
  weekSessions!: number;

  @ApiProperty({ type: SessionWeekDayResponseDto, isArray: true })
  weekDays!: SessionWeekDayResponseDto[];

  monthMinutes!: number;
}

export class GameSessionMutationResponseDto implements GameSessionMutationDto {
  @ApiProperty({ type: GameSessionResponseDto })
  session!: GameSessionResponseDto;

  @ApiProperty({ type: GameSessionSummaryResponseDto })
  summary!: GameSessionSummaryResponseDto;

  xpAwarded!: boolean;
}
