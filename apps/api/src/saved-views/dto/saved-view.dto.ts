import {
  MediaType,
  SAVED_VIEW_DOMAINS,
  SAVED_VIEW_LIMITS,
  SORT_ORDERS,
  type CreateSavedViewDto,
  type SavedViewDomain,
  type SavedViewDto,
  type SavedViewFiltersDto,
  type SortOrder,
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
  @IsIn(SORT_ORDERS)
  order?: SortOrder;
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
  /**
   * Text search.
   * @example "dune"
   */
  q?: string;

  /**
   * The domain's own statuses kept.
   * @example ["WATCHING", "PLANNED"]
   */
  statuses?: string[];

  /**
   * Only favourites.
   * @example true
   */
  favorite?: boolean;

  /**
   * Video types kept.
   * @example ["SERIES"]
   */
  types?: MediaType[];

  /**
   * The list's sort key.
   * @example "recent"
   */
  sort?: string;

  /**
   * Ascending or descending.
   * @example "desc"
   */
  order?: SortOrder;
}

export class SavedViewResponseDto implements SavedViewDto {
  /**
   * The view's id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * The view's name.
   * @example "Comfort shows"
   */
  name!: string;

  /**
   * The library the view filters.
   * @example "MEDIA"
   */
  domain!: SavedViewDomain;

  /** The filters it saves. */
  filters!: SavedViewFiltersResponseDto;

  /**
   * When it was created.
   * @example "2026-03-14T09:26:53.000Z"
   */
  createdAt!: string;

  /**
   * When it last changed.
   * @example "2026-09-30T21:00:00.000Z"
   */
  updatedAt!: string;
}
