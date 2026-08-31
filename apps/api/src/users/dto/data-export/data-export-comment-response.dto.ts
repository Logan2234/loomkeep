import type { CommentTargetType, DataExportComment } from "@loomkeep/shared";

export class DataExportCommentResponseDto implements DataExportComment {
  targetType!: CommentTargetType;
  targetId!: string;
  parentId!: string | null;
  text!: string | null;
  spoilerTag!: boolean;
  edited!: boolean;
  deletedAt!: string | null;
  createdAt!: string;
  updatedAt!: string;
}
