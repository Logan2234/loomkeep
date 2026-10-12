import type { ApiV1ReviewDto, ReviewVisibility } from "@loomkeep/shared";

import { ReviewVisibility as ReviewVisibilityValues } from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
import { ApiV1TargetResponseDto } from "./api-v1-target-response.dto";
export class ApiV1ReviewResponseDto implements ApiV1ReviewDto {
  /**
   * The review's id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * 0 to 10, half points allowed.
   * @example 9
   */
  rating!: number;

  /**
   * The review's text; null for a rating alone.
   * @example "Slow first act, then it never lets go."
   */
  text!: string | null;

  /**
   * Who can read it.
   * @example "PUBLIC"
   */
  @ApiProperty({ enum: Object.values(ReviewVisibilityValues) })
  visibility!: ReviewVisibility;

  /**
   * Marked as containing spoilers.
   * @example false
   */
  spoiler!: boolean;

  /**
   * When it was first written.
   * @example "2026-03-14T09:26:53.000Z"
   */
  createdAt!: string;

  /**
   * When it last changed.
   * @example "2026-09-30T21:00:00.000Z"
   */
  updatedAt!: string;

  /** The work, season or episode reviewed. */
  target!: ApiV1TargetResponseDto;
}
