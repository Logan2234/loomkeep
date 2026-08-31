import type { ReviewTargetSummaryDto } from "@loomkeep/shared";

// Duplicated from apps/api/src/reviews/dto (introduced in #170) until that
// PR merges — an identical add/add merges cleanly, no conflict expected.
export class ReviewTargetSummaryResponseDto implements ReviewTargetSummaryDto {
  title!: string;
  imageUrl!: string | null;
  href!: string | null;
}
