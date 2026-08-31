import type {
  PossessionBreakdownDto,
  StatsDomain,
  StatsOverviewDto,
} from "@loomkeep/shared";
import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger";
import { DecadeBucketResponseDto } from "./decade-bucket-response.dto";
import { DomainStatusBreakdownResponseDto } from "./domain-status-breakdown-response.dto";
import {
  InsufficientPossessionBreakdownResponseDto,
  SufficientPossessionBreakdownResponseDto,
} from "./possession-breakdown-response.dto";
import { RatingBucketResponseDto } from "./rating-bucket-response.dto";

@ApiExtraModels(
  SufficientPossessionBreakdownResponseDto,
  InsufficientPossessionBreakdownResponseDto,
)
export class StatsOverviewResponseDto implements StatsOverviewDto {
  domain!: "ALL" | StatsDomain;
  breakdowns!: DomainStatusBreakdownResponseDto[];
  total!: number;
  favorites!: number;
  completionRate!: number;
  abandonRate!: number;
  ratedCount!: number;
  ratingRate!: number;
  averageRating!: number | null;
  ratingDistribution!: RatingBucketResponseDto[];
  decades!: DecadeBucketResponseDto[];

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(SufficientPossessionBreakdownResponseDto) },
      { $ref: getSchemaPath(InsufficientPossessionBreakdownResponseDto) },
    ],
  })
  possession!: PossessionBreakdownDto;
}
