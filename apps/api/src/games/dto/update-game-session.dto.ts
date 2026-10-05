import {
  MAX_SESSION_DURATION_MINUTES,
  SESSION_NOTES_MAX_LENGTH,
  type UpdateGameSessionDto as Contract,
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

export class UpdateGameSessionDto implements Contract {
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
  @MaxLength(SESSION_NOTES_MAX_LENGTH)
  notes?: string | null;
}
