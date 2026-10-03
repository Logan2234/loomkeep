import type { CalendarEntryDto } from "@loomkeep/shared";
import { MediaItemResponseDto } from "./media-item-response.dto";

export class CalendarEntryResponseDto implements CalendarEntryDto {
  mediaItem!: MediaItemResponseDto;
  entryId!: string;
  episodeAlertsMuted!: boolean;
  episodesBehind!: number;
  seasonNumber!: number | null;
  episodeNumber!: number | null;
  releaseRegion?: string;
  releaseType?: "cinema" | "digital";
  episodeTitle!: string | null;
  airDate!: string;
}
