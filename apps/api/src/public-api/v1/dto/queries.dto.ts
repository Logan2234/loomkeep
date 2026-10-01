import type { ApiV1LibrarySort, ApiV1Phase } from "@loomkeep/shared";
import {
  API_V1_LIBRARY_SORTS,
  Locale,
  STATS_DOMAINS,
  StatsStatusBucket,
  type StatsDomain,
} from "@loomkeep/shared";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from "class-validator";

const API_V1_MAX_LIMIT = 100;

export class LangQueryDto {
  @ApiPropertyOptional({
    enum: Locale,
    description:
      "Language of video titles. Defaults to the account's language; a title not translated yet stays in English.",
  })
  @IsOptional()
  @IsIn(Locale)
  lang?: Locale;
}

class PageQueryDto extends LangQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: API_V1_MAX_LIMIT, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(API_V1_MAX_LIMIT)
  limit?: number;
}

export class LibraryQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: STATS_DOMAINS })
  @IsOptional()
  @IsIn(STATS_DOMAINS)
  domain?: StatsDomain;

  @ApiPropertyOptional({
    description:
      "One or more normalised statuses, comma-separated (e.g. `IN_PROGRESS,PLANNED`).",
    enum: Object.values(StatsStatusBucket),
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.split(",").map((v) => v.trim()) : value,
  )
  @IsIn(Object.values(StatsStatusBucket), { each: true })
  phase?: ApiV1Phase[];

  @ApiPropertyOptional({
    enum: ["true"],
    description: "Only favourites.",
  })
  @IsOptional()
  @IsIn(["true"])
  favorite?: "true";

  @ApiPropertyOptional({ enum: API_V1_LIBRARY_SORTS, default: "added" })
  @IsOptional()
  @IsIn(API_V1_LIBRARY_SORTS)
  sort?: ApiV1LibrarySort;

  @ApiPropertyOptional({
    enum: ["asc", "desc"],
    description:
      "`desc` keeps each sort's natural order (newest, best rated, A→Z for titles); `asc` reverses it.",
  })
  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc";
}

export class CalendarQueryDto extends LangQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 90,
    default: 7,
    description: "How many days ahead, today included.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}

export class ReviewsQueryDto extends LangQueryDto {
  @ApiPropertyOptional({ enum: STATS_DOMAINS })
  @IsOptional()
  @IsIn(STATS_DOMAINS)
  domain?: StatsDomain;
}

export class EntryHistoryQueryDto extends PageQueryDto {}

export class HistoryQueryDto extends PageQueryDto {
  @ApiPropertyOptional({
    description:
      "Start, included: a date (`2026-09-01`) or a date-time, in UTC.",
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    description:
      "End: a date includes that whole day (`2026-09-30`), a date-time is excluded. UTC.",
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({ enum: STATS_DOMAINS })
  @IsOptional()
  @IsIn(STATS_DOMAINS)
  domain?: StatsDomain;
}
