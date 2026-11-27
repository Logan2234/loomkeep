import type { CalendarEntryDto } from "@loomkeep/shared/contracts";
import { GameItemResponseDto } from "../../games/dto/game-item-response.dto";
import { MediaItemResponseDto } from "../../media/dto/media-item-response.dto";

export class CalendarEntryResponseDto implements CalendarEntryDto {
  mediaItem!: MediaItemResponseDto | null;
  game!: GameItemResponseDto | null;
  entryId!: string;
  episodeAlertsMuted!: boolean;
  episodesBehind!: number;
  seasonNumber!: number | null;
  episodeNumber!: number | null;
  releaseRegion?: string;
  releaseType?: "cinema" | "digital";
  releasePrecision?: "DAY" | "MONTH";
  episodeTitle!: string | null;
  seasonFinale?: boolean;
  airDate!: string;
}
