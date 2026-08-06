import {
  BookSource,
  BookStatus,
  UpsertBookEntryDto as UpsertBookEntryContract,
} from "@loomkeep/shared";
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

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
  rating?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;
}
