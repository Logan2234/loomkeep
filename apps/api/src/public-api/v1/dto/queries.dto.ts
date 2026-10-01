import type { ApiV1LibrarySort, ApiV1Phase } from "@loomkeep/shared";
import {
  API_V1_LIBRARY_SORTS,
  STATS_DOMAINS,
  StatsStatusBucket,
  type StatsDomain,
} from "@loomkeep/shared";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

const API_V1_MAX_LIMIT = 100;

class PageQueryDto {
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

export class CalendarQueryDto {
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

export class ReviewsQueryDto {
  @ApiPropertyOptional({ enum: STATS_DOMAINS })
  @IsOptional()
  @IsIn(STATS_DOMAINS)
  domain?: StatsDomain;
}
