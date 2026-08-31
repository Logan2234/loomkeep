import type { NextEpisodeDto } from "@loomkeep/shared";

export class NextEpisodeResponseDto implements NextEpisodeDto {
  episodeId!: string;
  seasonNumber!: number;
  episodeNumber!: number;
}
