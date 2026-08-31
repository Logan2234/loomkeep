import type { ExternalLinkDto } from "@loomkeep/shared";

export class ExternalLinkResponseDto implements ExternalLinkDto {
  name!: string;
  url!: string;
}
