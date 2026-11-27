import {
  type ReviewVoteValue,
  ReviewVoteValue as ReviewVoteValueEnum,
} from "@loomkeep/shared/enums";
import { IsIn } from "class-validator";

export class VoteReviewBody {
  @IsIn(Object.values(ReviewVoteValueEnum))
  value!: ReviewVoteValue;
}
