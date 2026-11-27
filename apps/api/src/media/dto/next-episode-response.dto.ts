import type { NextEpisodeDto } from "@loomkeep/shared/contracts";

export class NextEpisodeResponseDto implements NextEpisodeDto {
  episodeId!: string;
  seasonNumber!: number;
  episodeNumber!: number;
}
