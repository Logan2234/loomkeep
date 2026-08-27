import { Locale, MediaType } from "@loomkeep/shared";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";

export class SearchQueryDto {
  @IsString()
  @MinLength(1)
  q!: string;

  @IsOptional()
  @IsIn(Object.values(MediaType))
  type?: MediaType;

  // 1-based page for infinite scroll; providers paginate their own sources.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  // The client's active UI locale, so TMDB results come back in that
  // language when it has one.
  @IsOptional()
  @IsIn(Locale)
  lang?: string;
}
