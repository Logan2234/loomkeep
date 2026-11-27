import type { ExternalLinkDto } from "@loomkeep/shared/contracts";

export class ExternalLinkResponseDto implements ExternalLinkDto {
  name!: string;
  url!: string;
}
