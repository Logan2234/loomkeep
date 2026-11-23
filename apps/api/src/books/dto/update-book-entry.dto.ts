import {
  BookOwnershipStatus,
  BookStatus,
  ENTRY_NOTES_MAX_LENGTH,
  LOAN_PERSON_MAX_LENGTH,
  OWNERSHIP_SOURCE_MAX_LENGTH,
  UpdateBookEntryDto as UpdateBookEntryContract,
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
import { IsRatingStep } from "../../common/rating-step.validator";

export class UpdateBookEntryDto implements UpdateBookEntryContract {
  @IsOptional()
  @IsIn(Object.values(BookStatus))
  status?: BookStatus;

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
  @IsInt()
  @Min(0)
  currentPage?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  editionKey?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  referencePageCount?: number | null;

  @IsOptional()
  @IsDateString()
  startedAt?: string | null;

  @IsOptional()
  @IsDateString()
  finishedAt?: string | null;

  @IsOptional()
  @IsIn(Object.values(BookOwnershipStatus))
  ownershipStatus?: BookOwnershipStatus;

  @IsOptional()
  @IsString()
  @MaxLength(OWNERSHIP_SOURCE_MAX_LENGTH)
  ownershipSource?: string | null;

  @IsOptional()
  @IsBoolean()
  lentOut?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(LOAN_PERSON_MAX_LENGTH)
  loanPerson?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  loanSince?: string | null;
}
