import type { MusicExternalLinkDto } from "@loomkeep/shared";

export class MusicExternalLinkResponseDto implements MusicExternalLinkDto {
  label!: string;
  url!: string;
}
