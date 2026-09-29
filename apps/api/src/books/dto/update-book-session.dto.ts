import {
  MAX_SESSION_DURATION_MINUTES,
  type UpdateBookSessionDto as Contract,
} from "@loomkeep/shared";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateBookSessionDto implements Contract {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SESSION_DURATION_MINUTES)
  durationMinutes?: number;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

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
  startPage?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  endPage?: number | null;
}
