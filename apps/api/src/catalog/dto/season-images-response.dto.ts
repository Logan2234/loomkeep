import type { SeasonImagesDto } from "@loomkeep/shared/contracts";

export class SeasonImagesResponseDto implements SeasonImagesDto {
  images!: string[];
}
