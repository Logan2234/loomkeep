import type { EpisodeMediaDto } from "@loomkeep/shared";

class EpisodeVideoResponseDto {
  key!: string;
  type!: string;
}

export class EpisodeMediaResponseDto implements EpisodeMediaDto {
  images!: string[];
  videos!: EpisodeVideoResponseDto[];
}
