import type { ReviewVoteResultDto, ReviewVoteValue } from "@loomkeep/shared";

export class ReviewVoteResultResponseDto implements ReviewVoteResultDto {
  score!: number;
  myVote!: ReviewVoteValue;
}
