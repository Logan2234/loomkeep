import type { ApiV1HistoryEventDto, PagedResult } from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
import { ApiV1HistoryEventResponseDto } from "./api-v1-history-event-response.dto";
export class ApiV1HistoryPageResponseDto implements PagedResult<ApiV1HistoryEventDto> {
  /** This page's events, newest first. */
  @ApiProperty({ type: ApiV1HistoryEventResponseDto, isArray: true })
  items!: ApiV1HistoryEventResponseDto[];

  /**
   * Whether a next page exists.
   * @example true
   */
  hasMore!: boolean;

  /**
   * Events matching the filters, across all pages.
   * @example 1342
   */
  total!: number;
}
