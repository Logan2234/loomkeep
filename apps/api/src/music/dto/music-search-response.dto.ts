import type { MusicSearchResponseDto } from "@loomkeep/shared/contracts";
import { MusicSummaryResponseDto } from "./music-summary-response.dto";

export class MusicSearchResultResponseDto implements MusicSearchResponseDto {
  results!: MusicSummaryResponseDto[];
}
