import {
  BULK_ENTRIES_MAX_IDS,
  type BulkEntriesResultDto,
  type BulkEntriesTargetDto,
  OWNERSHIP_SOURCE_MAX_LENGTH,
} from "@loomkeep/shared";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { SavedViewFiltersBody } from "../../saved-views/dto/saved-view.dto";

export class BulkEntriesTargetBody implements BulkEntriesTargetDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BULK_ENTRIES_MAX_IDS)
  @IsString({ each: true })
  ids?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SavedViewFiltersBody)
  filters?: SavedViewFiltersBody;
}

/** What every domain's bulk update accepts besides its own `status` and `ownershipStatus`. */
export class BulkUpdateEntriesBaseBody extends BulkEntriesTargetBody {
  @IsOptional()
  @IsBoolean()
  favorite?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  listId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(OWNERSHIP_SOURCE_MAX_LENGTH)
  ownershipSource?: string | null;
}

export class BulkEntriesResultResponseDto implements BulkEntriesResultDto {
  updated!: number;
  skipped!: number;
}
