import type { ApiV1DomainStatsDto, StatsDomain } from "@loomkeep/shared";

import { STATS_DOMAINS } from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
import { ApiV1PhaseCountsResponseDto } from "./api-v1-phase-counts-response.dto";
export class ApiV1DomainStatsResponseDto implements ApiV1DomainStatsDto {
  /**
   * The domain counted.
   * @example "MEDIA"
   */
  @ApiProperty({ enum: STATS_DOMAINS })
  domain!: StatsDomain;

  /**
   * Entries in the domain.
   * @example 569
   */
  total!: number;

  /**
   * Of which favourites.
   * @example 42
   */
  favorites!: number;

  /** Entries per normalised status. */
  byPhase!: ApiV1PhaseCountsResponseDto;
}
