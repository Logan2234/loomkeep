import type {
  DataExportReviewVote,
  ReviewTargetType,
  ReviewVoteValue,
} from "@loomkeep/shared";

export class DataExportReviewVoteResponseDto implements DataExportReviewVote {
  targetType!: ReviewTargetType;
  targetId!: string;
  value!: ReviewVoteValue;
  createdAt!: string;
}
