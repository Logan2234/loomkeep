import {
  BookOwnershipStatus,
  BookStatus,
  ENTRY_NOTES_MAX_LENGTH,
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

export class UpdateBookEntryDto implements UpdateBookEntryContract {
  @IsOptional()
  @IsIn(Object.values(BookStatus))
  status?: BookStatus;

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
}
