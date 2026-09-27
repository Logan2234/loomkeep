import type {
  GameSessionDto,
  GameSessionMutationDto,
  GameSessionSummaryDto,
  SessionSource,
} from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

export class GameSessionResponseDto implements GameSessionDto {
  id!: string;
  durationMinutes!: number;
  occurredAt!: string;
  source!: SessionSource;
  createdAt!: string;
  updatedAt!: string;
}

export class GameSessionSummaryResponseDto implements GameSessionSummaryDto {
  @ApiProperty({ type: GameSessionResponseDto, isArray: true })
  items!: GameSessionResponseDto[];

  hasMore!: boolean;
  totalTrackedMinutes!: number;
  weekMinutes!: number;
  monthMinutes!: number;
}

export class GameSessionMutationResponseDto implements GameSessionMutationDto {
  @ApiProperty({ type: GameSessionResponseDto })
  session!: GameSessionResponseDto;

  @ApiProperty({ type: GameSessionSummaryResponseDto })
  summary!: GameSessionSummaryResponseDto;

  xpAwarded!: boolean;
}
