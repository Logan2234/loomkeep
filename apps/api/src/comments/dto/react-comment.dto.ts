import { Emote, type Emote as CommentEmoteT } from "@loomkeep/shared/enums";
import { IsIn } from "class-validator";

export class ReactCommentBody {
  @IsIn(Object.values(Emote))
  emote!: CommentEmoteT;
}
