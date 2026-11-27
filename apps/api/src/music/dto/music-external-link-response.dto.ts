import type { MusicExternalLinkDto } from "@loomkeep/shared/contracts";

export class MusicExternalLinkResponseDto implements MusicExternalLinkDto {
  label!: string;
  url!: string;
}
