import type { UpsertReviewDto } from "@loomkeep/shared/contracts";
import { REVIEW_TEXT_MAX_LENGTH } from "@loomkeep/shared/contracts";
import {
  ReviewVisibility as ReviewVisibilityEnum,
  type ReviewVisibility,
} from "@loomkeep/shared/enums";
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { IsRatingStep } from "../../common/rating-step.validator";

export class UpsertReviewBody implements UpsertReviewDto {
  // Mandatory /10 rating, in half points.
  @IsNumber()
  @Min(0)
  @Max(10)
  @IsRatingStep()
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(REVIEW_TEXT_MAX_LENGTH)
  text?: string | null;

  @IsOptional()
  @IsIn(Object.values(ReviewVisibilityEnum))
  visibility?: ReviewVisibility;

  @IsOptional()
  @IsBoolean()
  spoilerTag?: boolean;
}
