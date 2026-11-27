import {
  ENTRY_NOTES_MAX_LENGTH,
  UpsertLibraryEntryDto,
} from "@loomkeep/shared/contracts";
import { CatalogSource, EntryStatus, MediaType } from "@loomkeep/shared/enums";
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
import { IsRatingStep } from "../../common/rating-step.validator";

export class UpsertEntryDto implements UpsertLibraryEntryDto {
  @IsIn(Object.values(CatalogSource))
  source!: CatalogSource;

  @IsString()
  sourceId!: string;

  @IsIn(Object.values(MediaType))
  type!: MediaType;

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
}
