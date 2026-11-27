import type { CommentDto } from "@loomkeep/shared/contracts";
import type { CommentTargetType, Emote } from "@loomkeep/shared/enums";
import { UserSummaryResponseDto } from "../../common/dto/user-summary-response.dto";
import { CommentMentionResponseDto } from "./comment-mention-response.dto";
import { CommentReactionSummaryResponseDto } from "./comment-reaction-summary-response.dto";

export class CommentResponseDto implements CommentDto {
  id!: string;
  targetType!: CommentTargetType;
  targetId!: string;
  parentId!: string | null;
  text!: string | null;
  deleted!: boolean;
  deletedByAdmin!: boolean;
  edited!: boolean;
  spoilerTag!: boolean;
  masked!: boolean;
  createdAt!: string;
  updatedAt!: string;
  author!: UserSummaryResponseDto | null;
  mentions!: CommentMentionResponseDto[];
  reactions!: CommentReactionSummaryResponseDto[];
  myReaction!: Emote | null;
  replies!: CommentResponseDto[];
  replyCount!: number;
}
