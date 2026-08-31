import type { ReadingGoalDto } from "@loomkeep/shared";

export class ReadingGoalResponseDto implements ReadingGoalDto {
  year!: number;
  target!: number;
  completed!: number;
}
