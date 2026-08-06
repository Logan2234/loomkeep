import {
  CommentEmote,
  type CommentEmote as CommentEmoteT,
} from "@loomkeep/shared";
import { IsIn } from "class-validator";

export class ReactCommentBody {
  @IsIn(Object.values(CommentEmote))
  emote!: CommentEmoteT;
}
