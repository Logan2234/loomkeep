import { Emote, type Emote as CommentEmoteT } from "@loomkeep/shared";
import { IsIn } from "class-validator";

export class ReactCommentBody {
  @IsIn(Object.values(Emote))
  emote!: CommentEmoteT;
}
