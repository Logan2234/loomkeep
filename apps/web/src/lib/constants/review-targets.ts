import { DOMAINS } from "#lib/constants/domains.js";
import { recordFrom } from "#lib/object.js";
import { m } from "#lib/paraglide/messages.js";
import { REVIEW_TARGET_DOMAIN, ReviewTargetType } from "@loomkeep/shared";

export const REVIEW_TARGET_LABEL: Record<ReviewTargetType, string> = {
  get MEDIA() {
    return DOMAINS.MEDIA.label;
  },
  get GAME() {
    return DOMAINS.GAMES.label;
  },
  get BOOK() {
    return DOMAINS.BOOKS.label;
  },
  get MUSIC() {
    return DOMAINS.MUSIC.label;
  },
  get SEASON() {
    return m.common_season();
  },
  get EPISODE() {
    return m.common_episode();
  },
};
export const REVIEW_TARGET_HUE = recordFrom(
  Object.values(ReviewTargetType),
  (type) => DOMAINS[REVIEW_TARGET_DOMAIN[type]].accent,
);

export function activityTargetHue(type: string): string {
  return type === "MEDIA" ||
    type === "GAME" ||
    type === "BOOK" ||
    type === "MUSIC"
    ? REVIEW_TARGET_HUE[type]
    : "var(--dim)";
}
