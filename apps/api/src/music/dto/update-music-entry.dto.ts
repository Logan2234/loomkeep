import {
  ENTRY_NOTES_MAX_LENGTH,
  MusicOwnershipStatus,
  MusicStatus,
  OWNERSHIP_SOURCE_MAX_LENGTH,
  UpdateMusicEntryDto as UpdateMusicEntryContract,
} from "@loomkeep/shared";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateMusicEntryDto implements UpdateMusicEntryContract {
  @IsOptional()
  @IsIn(Object.values(MusicStatus))
  status?: MusicStatus;

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
  @IsDateString()
  startedAt?: string | null;

  @IsOptional()
  @IsDateString()
  finishedAt?: string | null;

  @IsOptional()
  @IsIn(Object.values(MusicOwnershipStatus))
  ownershipStatus?: MusicOwnershipStatus;

  @IsOptional()
  @IsString()
  @MaxLength(OWNERSHIP_SOURCE_MAX_LENGTH)
  ownershipSource?: string | null;
}
