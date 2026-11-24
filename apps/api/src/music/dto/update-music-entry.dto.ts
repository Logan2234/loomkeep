import {
  ENTRY_NOTES_MAX_LENGTH,
  LOAN_PERSON_MAX_LENGTH,
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
import { IsRatingStep } from "../../common/rating-step.validator";

export class UpdateMusicEntryDto implements UpdateMusicEntryContract {
  @IsOptional()
  @IsIn(Object.values(MusicStatus))
  status?: MusicStatus;

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

  @IsOptional()
  @IsBoolean()
  lentOut?: boolean;

  /** true: the running loan comes back; false: undoes that (the undo toast). */
  @IsOptional()
  @IsBoolean()
  loanReturned?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(LOAN_PERSON_MAX_LENGTH)
  loanPerson?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  loanSince?: string | null;
}
