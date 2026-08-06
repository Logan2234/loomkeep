import {
  REVIEW_TEXT_MAX_LENGTH,
  type ReviewVisibility,
  ReviewVisibility as ReviewVisibilityEnum,
} from "@loomkeep/shared";
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpsertReviewBody {
  // Mandatory /10 rating, half-point steps enforced client-side.
  @IsNumber()
  @Min(0)
  @Max(10)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(REVIEW_TEXT_MAX_LENGTH)
  text?: string | null;

  @IsOptional()
  @IsIn(Object.values(ReviewVisibilityEnum))
  visibility?: ReviewVisibility;
}
