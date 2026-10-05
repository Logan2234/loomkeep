import {
  MAX_PAGE_NUMBER,
  MAX_SESSION_DURATION_MINUTES,
  SESSION_NOTES_MAX_LENGTH,
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
  @MaxLength(SESSION_NOTES_MAX_LENGTH)
  notes?: string | null;

  @IsOptional()
  @IsIn(Object.values(SessionCycleAction))
  cycleAction?: SessionCycleAction;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_NUMBER)
  pagesRead?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PAGE_NUMBER)
  startPage?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_NUMBER)
  endPage?: number;
}
