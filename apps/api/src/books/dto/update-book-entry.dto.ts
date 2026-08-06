import {
  BookOwnershipStatus,
  BookStatus,
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
  @MaxLength(5000)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentPage?: number;

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
  @MaxLength(100)
  ownershipSource?: string | null;
}
