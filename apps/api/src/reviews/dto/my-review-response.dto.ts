import type { MyReviewDto } from "@loomkeep/shared";
import { ReviewResponseDto } from "./review-response.dto";
import { ReviewTargetSummaryResponseDto } from "./review-target-summary-response.dto";

export class MyReviewResponseDto
  extends ReviewResponseDto
  implements MyReviewDto
{
  target!: ReviewTargetSummaryResponseDto | null;
}
