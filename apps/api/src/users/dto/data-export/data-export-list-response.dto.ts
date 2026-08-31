import type {
  DataExportList,
  DataExportListItem,
  ListKind,
  ListVisibility,
  ReviewTargetType,
} from "@loomkeep/shared";

class DataExportListItemResponseDto implements DataExportListItem {
  targetType!: ReviewTargetType;
  targetId!: string;
  position!: number;
  addedAt!: string;
}

export class DataExportListResponseDto implements DataExportList {
  title!: string;
  description!: string | null;
  kind!: ListKind;
  visibility!: ListVisibility;
  createdAt!: string;
  updatedAt!: string;
  items!: DataExportListItemResponseDto[];
}
