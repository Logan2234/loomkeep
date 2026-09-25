import {
  type ReviewVoteValue,
  ReviewVoteValue as ReviewVoteValueEnum,
} from "@loomkeep/shared";
import { IsIn } from "class-validator";

export class VoteReviewBody {
  @IsIn(Object.values(ReviewVoteValueEnum))
  value!: ReviewVoteValue;
}
