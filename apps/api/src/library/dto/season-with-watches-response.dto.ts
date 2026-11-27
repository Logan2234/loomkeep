import type { SeasonWithWatchesDto } from "@loomkeep/shared/contracts";
import { EpisodeWithWatchesResponseDto } from "./episode-with-watches-response.dto";

export class SeasonWithWatchesResponseDto implements SeasonWithWatchesDto {
  id!: string;
  number!: number;
  title!: string | null;
  episodes!: EpisodeWithWatchesResponseDto[];
}
