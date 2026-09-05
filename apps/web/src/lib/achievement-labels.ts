// Display text and glyph for one achievement entry, resolved from its
// registry key — the part of ../../routes/app/achievements/labels.ts that
// has no dependency on that route's own concepts (AchievementGroup,
// family sections), so it's shared with anywhere else an AchievementDto
// needs to render on its own (the [G9] profile badge showcase, the [G6]
// unlock bubble).
import { m } from "$lib/paraglide/messages.js";
import type { IconName } from "$lib/types/icon-name";
import type { AchievementDto, AchievementFamily } from "@loomkeep/shared";

/**
 * Names and descriptions are keyed by the achievement's own registry key
 * (`gamification_<key>_name` / `_description`, shipped in [G3]), so they are
 * looked up by construction rather than through an explicit map like
 * `errors.ts`'s: the keys arrive from the API as plain strings, so a map
 * would buy no compile-time completeness check for its 100-odd entries. `m`
 * is a namespace object of every message, already imported whole everywhere
 * in the app, so indexing it costs nothing extra.
 */
const messages = m as unknown as Record<string, (() => string) | undefined>;

/** The name is shared by every tier of a family (`gamification_cinephile_name`). */
export function achievementName(entry: AchievementDto): string {
  if (entry.key === null) return m.gamification_secret_locked_name();
  const root = entry.tierOf ?? entry.key;
  return messages[`gamification_${root}_name`]?.() ?? root;
}

/** The description is per tier — it carries that tier's threshold. */
export function achievementDescription(entry: AchievementDto): string {
  if (entry.key === null) return m.gamification_secret_locked_description();
  return messages[`gamification_${entry.key}_description`]?.() ?? "";
}

// Glyph per achievement family root ([G3] shipped a shared base icon set, not
// a bespoke badge per entry — see the "badge artwork stays glyph-only"
// reservation). Anything unmapped falls back to its page family's glyph.
const GROUP_ICON: Record<string, IconName> = {
  first_episode: "footprint",
  cinephile: "play",
  episode_watcher: "tv",
  series_finisher: "check",
  book_finisher: "book",
  game_finisher: "gamepad",
  marathon: "activity",
  night_owl: "moon",
  early_bird: "sun",
  streak: "flame",
  full_circle: "circle-arrow",
  welcome_back: "circle-arrow",
  decades: "hourglass",
  genres: "compass",
  omnivore: "sparkles",
  hidden_gem: "compass",
  big_screen: "monitor",
  well_rounded: "star",
  full_inventory: "archive",
  guilty_pleasure: "mask",
  halloween: "pumpkin",
  contemporary: "calendar",
  new_year_finish: "shooting-star",
  anniversary: "calendar",
  first_comment: "message",
  chatterbox: "message",
  icebreaker: "message",
  first_take: "edit",
  crowd_favorite: "star",
  standing_ovation: "star",
  first_list: "list",
  curator: "list",
  followers: "users",
  has_friends: "users",
  one_sided: "users",
  locked_down: "lock",
  member_since: "hourglass",
  fresh_start: "download",
  profile_complete: "user",
  no_favorites: "eye-off",
  double_life: "mask",
  curious_cat: "search",
};

const FAMILY_ICON: Record<AchievementFamily, IconName> = {
  volume: "library",
  ritual: "flame",
  exploration: "compass",
  completion: "check",
  seasonal: "calendar",
  social: "users",
  account: "user",
  misc: "sparkles",
};

export function entryIcon(entry: AchievementDto): IconName {
  if (entry.key === null) return "question";
  return GROUP_ICON[entry.tierOf ?? entry.key] ?? FAMILY_ICON[entry.family];
}
