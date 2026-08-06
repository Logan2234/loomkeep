import {
  type ReviewVisibility,
  ReviewVisibility as ReviewVisibilityEnum,
} from "@loomkeep/shared";
import { ArrayNotEmpty, IsArray, IsIn, IsString } from "class-validator";

/** Bulk-delete a set of the current user's reviews, by review id. */
export class BatchDeleteReviewsBody {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}

/** Bulk-change the audience of a set of the current user's reviews. */
export class BatchVisibilityBody {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];

  @IsIn(Object.values(ReviewVisibilityEnum))
  visibility!: ReviewVisibility;
}
