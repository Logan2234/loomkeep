import {
  type ReviewVoteValue,
  ReviewVoteValue as ReviewVoteValueEnum,
} from "@loomkeep/shared";
import { IsIn } from "class-validator";

/** Casts (or replaces) the viewer's vote on someone else's review. */
export class VoteReviewBody {
  @IsIn(Object.values(ReviewVoteValueEnum))
  value!: ReviewVoteValue;
}
