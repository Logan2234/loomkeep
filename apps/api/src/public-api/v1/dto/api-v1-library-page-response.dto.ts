import type { ApiV1LibraryEntryDto, PagedResult } from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
import { ApiV1LibraryEntryResponseDto } from "./api-v1-library-entry-response.dto";
export class ApiV1LibraryPageResponseDto implements PagedResult<ApiV1LibraryEntryDto> {
  /** This page's entries. */
  @ApiProperty({ type: ApiV1LibraryEntryResponseDto, isArray: true })
  items!: ApiV1LibraryEntryResponseDto[];

  /**
   * Whether a next page exists.
   * @example true
   */
  hasMore!: boolean;

  /**
   * Entries matching the filters, across all pages.
   * @example 248
   */
  total!: number;
}
