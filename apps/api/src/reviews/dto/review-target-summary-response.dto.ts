import type { ReviewTargetSummaryDto } from "@loomkeep/shared/contracts";

export class ReviewTargetSummaryResponseDto implements ReviewTargetSummaryDto {
  title!: string;
  imageUrl!: string | null;
  href!: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}
