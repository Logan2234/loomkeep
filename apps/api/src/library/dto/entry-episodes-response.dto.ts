import type { EntryEpisodesResponseDto } from "@loomkeep/shared";
import { SeasonWithWatchesResponseDto } from "./season-with-watches-response.dto";

export class EntryEpisodesResponseResponseDto implements EntryEpisodesResponseDto {
  seasons!: SeasonWithWatchesResponseDto[];
}
