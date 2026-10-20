import {
  MAX_PAGE_NUMBER,
  SESSION_NOTES_MAX_LENGTH,
  SessionCycleAction,
  type FinishSessionTimerDto as Contract,
} from "@loomkeep/shared";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class FinishSessionTimerDto implements Contract {
  @IsOptional()
  @IsIn(Object.values(SessionCycleAction))
  cycleAction?: SessionCycleAction;

  @IsOptional()
  @IsString()
  @MaxLength(SESSION_NOTES_MAX_LENGTH)
  notes?: string | null;

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
