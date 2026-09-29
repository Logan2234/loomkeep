import {
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
  @MaxLength(1000)
  notes?: string | null;

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
