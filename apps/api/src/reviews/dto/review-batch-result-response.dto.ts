import type { ReviewBatchResultDto } from "@loomkeep/shared/contracts";

export class ReviewBatchResultResponseDto implements ReviewBatchResultDto {
  count!: number;
}
