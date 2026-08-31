import type {
  DataExportReview,
  ReviewTargetType,
  ReviewVisibility,
} from "@loomkeep/shared";

class DataExportReviewRevisionResponseDto {
  rating!: number;
  text!: string | null;
  createdAt!: string;
}

export class DataExportReviewResponseDto implements DataExportReview {
  targetType!: ReviewTargetType;
  targetId!: string;
  targetTitle!: string | null;
  rating!: number;
  text!: string | null;
  visibility!: ReviewVisibility;
  createdAt!: string;
  updatedAt!: string;
  revisions!: DataExportReviewRevisionResponseDto[];
}
