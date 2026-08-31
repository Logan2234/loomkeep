import type {
  ReviewDto,
  ReviewTargetType,
  ReviewVisibility,
  ReviewVoteValue,
} from "@loomkeep/shared";
import { UserSummaryResponseDto } from "../../common/dto/user-summary-response.dto";

export class ReviewResponseDto implements ReviewDto {
  id!: string;
  targetType!: ReviewTargetType;
  targetId!: string;
  rating!: number;
  text!: string | null;
  visibility!: ReviewVisibility;
  createdAt!: string;
  updatedAt!: string;
  author!: UserSummaryResponseDto | null;
  voteScore!: number;
  myVote!: ReviewVoteValue | null;
}
