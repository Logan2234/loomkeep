import type { ReviewTargetSummaryDto } from "@loomkeep/shared";

export class ReviewTargetSummaryResponseDto implements ReviewTargetSummaryDto {
  title!: string;
  imageUrl!: string | null;
  href!: string | null;
}
