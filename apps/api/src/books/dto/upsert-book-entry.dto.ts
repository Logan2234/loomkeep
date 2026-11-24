import {
  BookSource,
  BookStatus,
  ENTRY_NOTES_MAX_LENGTH,
  MAX_REFERENCE_PAGE_COUNT,
  UpsertBookEntryDto as UpsertBookEntryContract,
} from "@loomkeep/shared";
import {
  IsBoolean,
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

export class UpsertBookEntryDto implements UpsertBookEntryContract {
  @IsIn(Object.values(BookSource))
  source!: BookSource;

  @IsString()
  sourceId!: string;

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
  @IsString()
  @MaxLength(200)
  editionKey?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_REFERENCE_PAGE_COUNT)
  referencePageCount?: number | null;
}
