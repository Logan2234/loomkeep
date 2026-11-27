import type { Emote } from "@loomkeep/shared/enums";

/** Display glyph for each Emote, in a fixed picker order. */
export const COMMENT_EMOTE_DISPLAY: Record<Emote, string> = {
  LIKE: "👍",
  LOVE: "❤️",
  LAUGH: "😂",
  WOW: "😮",
  SAD: "😢",
  DISLIKE: "👎",
};
