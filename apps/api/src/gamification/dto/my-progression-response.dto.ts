import type { MyProgressionDto } from "@loomkeep/shared";

export class MyProgressionResponseDto implements MyProgressionDto {
  xp!: number | null;
}
