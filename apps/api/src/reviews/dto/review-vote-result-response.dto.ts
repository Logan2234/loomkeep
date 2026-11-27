import type { ReviewVoteResultDto } from "@loomkeep/shared/contracts";
import type { ReviewVoteValue } from "@loomkeep/shared/enums";

export class ReviewVoteResultResponseDto implements ReviewVoteResultDto {
  score!: number;
  myVote!: ReviewVoteValue;
}
