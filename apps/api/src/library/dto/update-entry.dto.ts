import {
  ENTRY_NOTES_MAX_LENGTH,
  EntryStatus,
  MediaOwnershipStatus,
  OWNERSHIP_SOURCE_MAX_LENGTH,
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
import { IsRatingStep } from "../../common/rating-step.validator";

export class UpdateEntryDto {
  @IsOptional()
  @IsIn(Object.values(EntryStatus))
  status?: EntryStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  @IsRatingStep()
  rating?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(ENTRY_NOTES_MAX_LENGTH)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;

  @IsOptional()
  @IsBoolean()
  episodeAlertsMuted?: boolean;

  @IsOptional()
  @IsBoolean()
  movieReleaseAlertsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  rewatching?: boolean;

  @IsOptional()
  @IsDateString()
  startedAt?: string | null;

  @IsOptional()
  @IsDateString()
  finishedAt?: string | null;

  @IsOptional()
  @IsIn(Object.values(MediaOwnershipStatus))
  ownershipStatus?: MediaOwnershipStatus;

  @IsOptional()
  @IsString()
  @MaxLength(OWNERSHIP_SOURCE_MAX_LENGTH)
  ownershipSource?: string | null;
}
