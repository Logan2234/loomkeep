import type { MyProgressionDto } from "@loomkeep/shared/contracts";

export class MyProgressionResponseDto implements MyProgressionDto {
  xp!: number | null;
}
