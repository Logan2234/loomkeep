import {
  MAX_SESSION_DURATION_MINUTES,
  SessionCycleAction,
  type CreateGameSessionDto as Contract,
} from "@loomkeep/shared";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateGameSessionDto implements Contract {
  @IsInt()
  @Min(1)
  @Max(MAX_SESSION_DURATION_MINUTES)
  durationMinutes!: number;

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsOptional()
  @IsIn(Object.values(SessionCycleAction))
  cycleAction?: SessionCycleAction;
}
