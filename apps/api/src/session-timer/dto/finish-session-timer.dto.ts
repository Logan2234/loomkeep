import type { FinishSessionTimerDto as Contract } from "@loomkeep/shared";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class FinishSessionTimerDto implements Contract {
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
