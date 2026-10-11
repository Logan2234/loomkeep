import type { CommentEmote } from "@loomkeep/shared";

/** Display glyph for each CommentEmote, in a fixed picker order. */
export const COMMENT_EMOTE_DISPLAY: Record<CommentEmote, string> = {
  LIKE: "👍",
  LOVE: "❤️",
  LAUGH: "😂",
  WOW: "😮",
  SAD: "😢",
  DISLIKE: "👎",
};
