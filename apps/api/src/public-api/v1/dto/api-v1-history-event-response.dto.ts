import type {
  ApiV1HistoryEventDto,
  ApiV1HistoryEventType,
} from "@loomkeep/shared";

import { API_V1_HISTORY_EVENT_TYPES } from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
import { ApiV1HistoryEpisodeResponseDto } from "./api-v1-history-episode-response.dto";
import { ApiV1HistoryPagesResponseDto } from "./api-v1-history-pages-response.dto";
import { ApiV1WorkResponseDto } from "./api-v1-work-response.dto";
export class ApiV1HistoryEventResponseDto implements ApiV1HistoryEventDto {
  /**
   * The event's id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * What happened.
   * @example "EPISODE_WATCHED"
   */
  @ApiProperty({ enum: API_V1_HISTORY_EVENT_TYPES })
  type!: ApiV1HistoryEventType;

  /**
   * When it happened; null when unknown (often an import). Undated events
   * only show in their entry's own history.
   * @example "2026-09-30T21:00:00.000Z"
   */
  date!: string | null;

  /**
   * The library entry the event belongs to.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  entryId!: string;

  /** The work involved. */
  work!: ApiV1WorkResponseDto;

  /** The episode, for EPISODE_WATCHED; null otherwise. */
  @ApiProperty({ type: ApiV1HistoryEpisodeResponseDto, nullable: true })
  episode!: ApiV1HistoryEpisodeResponseDto | null;

  /**
   * Viewing (films), playthrough (games) or reading (books) number, 1 for the
   * first; null for episodes, albums and sessions outside a cycle.
   * @example 1
   */
  cycle!: number | null;

  /**
   * A session's length, or the episode's, film's or album's runtime; null
   * when unknown.
   * @example 52
   */
  durationMinutes!: number | null;

  /** Pages read, for BOOK_SESSION; null otherwise. */
  @ApiProperty({ type: ApiV1HistoryPagesResponseDto, nullable: true })
  pages!: ApiV1HistoryPagesResponseDto | null;

  /**
   * The session's own notes; null otherwise.
   * @example "Finally beat the second boss"
   */
  notes!: string | null;
}
