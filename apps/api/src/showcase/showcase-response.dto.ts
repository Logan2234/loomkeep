import type { ShowcaseDto } from "@loomkeep/shared";

export class ShowcaseResponseDto implements ShowcaseDto {
  posters!: string[];
}
