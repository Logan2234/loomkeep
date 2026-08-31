import type { ListItemDto, ListItemTargetType } from "@loomkeep/shared";
import { ReviewTargetSummaryResponseDto } from "./review-target-summary-response.dto";

export class ListItemResponseDto implements ListItemDto {
  id!: string;
  targetType!: ListItemTargetType;
  targetId!: string;
  position!: number;
  addedAt!: string;
  target!: ReviewTargetSummaryResponseDto | null;
}
