import {
  MediaType,
  SAVED_VIEW_DOMAINS,
  SAVED_VIEW_LIMITS,
  type CreateSavedViewDto,
  type SavedViewDomain,
  type SavedViewDto,
  type SavedViewFiltersDto,
  type UpdateSavedViewDto,
} from "@loomkeep/shared";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

// Generous bounds: the status and sort keys themselves are checked against
// the view's domain by the service, or ignored by its list.
const KEY_LENGTH = 32;
const MAX_STATUSES = 10;

export class SavedViewFiltersBody implements SavedViewFiltersDto {
  @IsOptional()
  @IsString()
  @MaxLength(SAVED_VIEW_LIMITS.queryLength)
  q?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_STATUSES)
  @IsString({ each: true })
  @MaxLength(KEY_LENGTH, { each: true })
  statuses?: string[];

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(Object.values(MediaType).length)
  @IsIn(Object.values(MediaType), { each: true })
  types?: MediaType[];

  @IsOptional()
  @IsString()
  @MaxLength(KEY_LENGTH)
  sort?: string;

  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc";
}

export class CreateSavedViewBody implements CreateSavedViewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(SAVED_VIEW_LIMITS.nameLength)
  name!: string;

  @IsIn(SAVED_VIEW_DOMAINS)
  domain!: SavedViewDomain;

  @IsObject()
  @ValidateNested()
  @Type(() => SavedViewFiltersBody)
  filters!: SavedViewFiltersBody;
}

export class UpdateSavedViewBody implements UpdateSavedViewDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(SAVED_VIEW_LIMITS.nameLength)
  name?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SavedViewFiltersBody)
  filters?: SavedViewFiltersBody;
}

export class SavedViewFiltersResponseDto implements SavedViewFiltersDto {
  q?: string;
  statuses?: string[];
  favorite?: boolean;
  types?: MediaType[];
  sort?: string;
  order?: "asc" | "desc";
}

export class SavedViewResponseDto implements SavedViewDto {
  id!: string;
  name!: string;
  domain!: SavedViewDomain;
  filters!: SavedViewFiltersResponseDto;
  createdAt!: string;
  updatedAt!: string;
}
