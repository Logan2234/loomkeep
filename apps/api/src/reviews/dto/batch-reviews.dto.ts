import {
  type ReviewVisibility,
  ReviewVisibility as ReviewVisibilityEnum,
} from "@loomkeep/shared";
import { ArrayNotEmpty, IsArray, IsIn, IsString } from "class-validator";

export class BatchDeleteReviewsBody {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}

export class BatchVisibilityBody {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];

  @IsIn(Object.values(ReviewVisibilityEnum))
  visibility!: ReviewVisibility;
}
