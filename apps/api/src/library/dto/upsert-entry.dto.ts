import {
  CatalogSource,
  EntryStatus,
  MediaType,
  UpsertLibraryEntryDto,
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
  rating?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;
}
