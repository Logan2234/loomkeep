import type {
  CommentDto,
  CommentEmote,
  CommentTargetType,
} from "@loomkeep/shared";
import { UserSummaryResponseDto } from "../../common/dto/user-summary-response.dto";
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
  reactions!: CommentReactionSummaryResponseDto[];
  myReaction!: CommentEmote | null;
  replies!: CommentResponseDto[];
}
