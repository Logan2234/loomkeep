import {
  MAX_SESSION_DURATION_MINUTES,
  SessionCycleAction,
  type CreateBookSessionDto as Contract,
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

export class CreateBookSessionDto implements Contract {
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

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  pagesRead?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  startPage?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  endPage?: number;
}
