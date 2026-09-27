import type { CalendarEntryDto } from "@loomkeep/shared";
import { MediaItemResponseDto } from "./media-item-response.dto";

export class CalendarEntryResponseDto implements CalendarEntryDto {
  mediaItem!: MediaItemResponseDto;
  entryId!: string;
  episodeAlertsMuted!: boolean;
  seasonNumber!: number;
  episodeNumber!: number;
  episodeTitle!: string | null;
  airDate!: string;
}
