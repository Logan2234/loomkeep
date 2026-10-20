import type {
  DataExportReview,
  ReviewTargetType,
  ReviewVisibility,
} from "@loomkeep/shared";

class DataExportReviewRevisionResponseDto {
  /**
   * The rating at that point.
   * @example 8
   */
  rating!: number;

  /**
   * The text at that point.
   * @example "Slow first act."
   */
  text!: string | null;

  /**
   * When this version was replaced.
   * @example "2026-04-02T18:00:00.000Z"
   */
  createdAt!: string;
}

export class DataExportReviewResponseDto implements DataExportReview {
  /**
   * What is reviewed: a work, a SEASON or an EPISODE.
   * @example "MEDIA"
   */
  targetType!: ReviewTargetType;

  /**
   * Its Loomkeep id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  targetId!: string;

  /**
   * Its title, when it can still be resolved.
   * @example "Severance"
   */
  targetTitle!: string | null;

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
  visibility!: ReviewVisibility;

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

  /** Earlier versions, newest first. */
  revisions!: DataExportReviewRevisionResponseDto[];
}
