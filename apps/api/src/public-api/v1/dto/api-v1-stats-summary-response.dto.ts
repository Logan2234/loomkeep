import type { ApiV1StatsSummaryDto } from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
import { ApiV1BookStatsResponseDto } from "./api-v1-book-stats-response.dto";
import { ApiV1DomainStatsResponseDto } from "./api-v1-domain-stats-response.dto";
import { ApiV1GameStatsResponseDto } from "./api-v1-game-stats-response.dto";
import { ApiV1MusicStatsResponseDto } from "./api-v1-music-stats-response.dto";
import { ApiV1VideoStatsResponseDto } from "./api-v1-video-stats-response.dto";
export class ApiV1StatsSummaryResponseDto implements ApiV1StatsSummaryDto {
  /**
   * Entries across the enabled domains.
   * @example 812
   */
  total!: number;

  /**
   * Of which favourites.
   * @example 63
   */
  favorites!: number;

  /**
   * Average of the account's ratings, 0 to 10; null without any.
   * @example 7.4
   */
  averageRating!: number | null;

  /** Counts per enabled domain. */
  @ApiProperty({ type: ApiV1DomainStatsResponseDto, isArray: true })
  domains!: ApiV1DomainStatsResponseDto[];

  /** Video time; null when the domain is turned off for the account. */
  @ApiProperty({ type: ApiV1VideoStatsResponseDto, nullable: true })
  video!: ApiV1VideoStatsResponseDto | null;

  /** Game time; null when the domain is turned off. */
  @ApiProperty({ type: ApiV1GameStatsResponseDto, nullable: true })
  games!: ApiV1GameStatsResponseDto | null;

  /** Reading; null when the domain is turned off. */
  @ApiProperty({ type: ApiV1BookStatsResponseDto, nullable: true })
  books!: ApiV1BookStatsResponseDto | null;

  /** Listening; null when the domain is turned off. */
  @ApiProperty({ type: ApiV1MusicStatsResponseDto, nullable: true })
  music!: ApiV1MusicStatsResponseDto | null;
}
