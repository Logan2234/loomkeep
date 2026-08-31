import type { DataExportReadingGoal } from "@loomkeep/shared";

export class DataExportReadingGoalResponseDto implements DataExportReadingGoal {
  year!: number;
  target!: number;
  createdAt!: string;
  updatedAt!: string;
}
