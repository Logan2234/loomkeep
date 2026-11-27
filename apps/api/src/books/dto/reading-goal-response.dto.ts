import type { ReadingGoalDto } from "@loomkeep/shared/contracts";

export class ReadingGoalResponseDto implements ReadingGoalDto {
  year!: number;
  target!: number;
  completed!: number;
}
