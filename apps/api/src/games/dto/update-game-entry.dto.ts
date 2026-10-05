import {
  ENTRY_NOTES_MAX_LENGTH,
  GameOwnershipStatus,
  GameStatus,
  OWNERSHIP_SOURCE_MAX_LENGTH,
  UpdateGameEntryDto as UpdateGameEntryContract,
} from "@loomkeep/shared";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateGameEntryDto implements UpdateGameEntryContract {
  @IsOptional()
  @IsIn(Object.values(GameStatus))
  status?: GameStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  rating?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(ENTRY_NOTES_MAX_LENGTH)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  playtimeMinutes?: number;

  @IsOptional()
  @IsDateString()
  startedAt?: string | null;

  @IsOptional()
  @IsDateString()
  finishedAt?: string | null;

  @IsOptional()
  @IsIn(Object.values(GameOwnershipStatus))
  ownershipStatus?: GameOwnershipStatus;

  @IsOptional()
  @IsString()
  @MaxLength(OWNERSHIP_SOURCE_MAX_LENGTH)
  ownershipSource?: string | null;

  @IsOptional()
  @IsBoolean()
  releaseAlertsEnabled?: boolean;
}
