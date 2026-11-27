import type { EntryEpisodesResponseDto } from "@loomkeep/shared/contracts";
import { SeasonWithWatchesResponseDto } from "./season-with-watches-response.dto";

export class EntryEpisodesResponseResponseDto implements EntryEpisodesResponseDto {
  seasons!: SeasonWithWatchesResponseDto[];
}
