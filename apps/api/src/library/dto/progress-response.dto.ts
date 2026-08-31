import type { ProgressDto } from "@loomkeep/shared";
import { NextEpisodeResponseDto } from "./next-episode-response.dto";

export class ProgressResponseDto implements ProgressDto {
  watchedEpisodes!: number;
  totalEpisodes!: number;
  nextEpisode!: NextEpisodeResponseDto | null;
}
