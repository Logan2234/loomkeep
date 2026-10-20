import type {
  DataExportReviewVote,
  ReviewTargetType,
  ReviewVoteValue,
} from "@loomkeep/shared";

export class DataExportReviewVoteResponseDto implements DataExportReviewVote {
  /**
   * What the voted review is about.
   * @example "MEDIA"
   */
  targetType!: ReviewTargetType;

  /**
   * The review's id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  targetId!: string;

  /**
   * UP or DOWN.
   * @example "UP"
   */
  value!: ReviewVoteValue;

  /**
   * When the vote was cast.
   * @example "2026-09-30T21:00:00.000Z"
   */
  createdAt!: string;
}
