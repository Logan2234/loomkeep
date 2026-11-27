import type { ShowcaseDto } from "@loomkeep/shared/contracts";

export class ShowcaseResponseDto implements ShowcaseDto {
  posters!: string[];
}
