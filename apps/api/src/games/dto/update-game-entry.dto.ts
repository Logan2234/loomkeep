import {
  ENTRY_NOTES_MAX_LENGTH,
  GAME_PLATFORM_MAX_LENGTH,
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
  // Over a century of play: anything above is a typo, and past 2^31 the
  // Int column refused it with a 500.
  @Max(60_000_000)
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
  @IsString()
  @MaxLength(GAME_PLATFORM_MAX_LENGTH)
  platform?: string | null;

  @IsOptional()
  @IsBoolean()
  releaseAlertsEnabled?: boolean;
}
