import type {
  ApiV1LibraryEntryDto,
  ApiV1Phase,
  StatsDomain,
} from "@loomkeep/shared";

import { STATS_DOMAINS, StatsStatusBucket } from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
import { ApiV1ProgressResponseDto } from "./api-v1-progress-response.dto";
import { ApiV1WorkResponseDto } from "./api-v1-work-response.dto";
const PHASES = Object.values(StatsStatusBucket);

export class ApiV1LibraryEntryResponseDto implements ApiV1LibraryEntryDto {
  /**
   * The library entry's id, for `GET /v1/library/{id}`.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * The domain of the entry.
   * @example "MEDIA"
   */
  @ApiProperty({ enum: STATS_DOMAINS })
  domain!: StatsDomain;

  /**
   * The domain's own status: WATCHING, PLAYING, READ, LISTENED… See the
   * Conventions guide.
   * @example "WATCHING"
   */
  status!: string;

  /**
   * The status normalised across domains, also what `?phase=` filters on.
   * @example "IN_PROGRESS"
   */
  @ApiProperty({ enum: PHASES })
  phase!: ApiV1Phase;

  /**
   * Marked as a favourite.
   * @example true
   */
  favorite!: boolean;

  /**
   * The account's rating, 0 to 10 with half points; null when not rated.
   * @example 8.5
   */
  rating!: number | null;

  /**
   * Private notes on the entry.
   * @example "Rewatch season 1 before season 2"
   */
  notes!: string | null;

  /**
   * When it was started; null when unknown.
   * @example "2026-09-02T20:15:00.000Z"
   */
  startedAt!: string | null;

  /**
   * When it was finished; null when not finished, or unknown.
   * @example "2026-09-28T22:40:00.000Z"
   */
  finishedAt!: string | null;

  /**
   * When it was added to the library.
   * @example "2026-03-14T09:26:53.000Z"
   */
  addedAt!: string;

  /**
   * Episodes for series and anime, pages for books, playtime for games; null
   * otherwise.
   */
  @ApiProperty({ type: ApiV1ProgressResponseDto, nullable: true })
  progress!: ApiV1ProgressResponseDto | null;

  /** The work itself. */
  work!: ApiV1WorkResponseDto;
}
