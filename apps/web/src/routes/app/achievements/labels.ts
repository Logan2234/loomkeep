// Display text and glyph for one achievement, resolved from its registry key.
import { formatDate, formatNumber } from "$lib/format";
import { m } from "$lib/paraglide/messages.js";
import type { IconName } from "$lib/types/icon-name";
import type {
  AchievementDto,
  AchievementFamily,
  AchievementTier,
} from "@loomkeep/shared";
import type { AchievementGroup } from "./achievements";

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

export function tierLabel(tier: AchievementTier | null): string {
  if (tier === "bronze") return m.gamification_tier_bronze();
  if (tier === "silver") return m.gamification_tier_silver();
  if (tier === "gold") return m.gamification_tier_gold();
  return m.gamification_tier_single();
}

export function familyLabel(family: AchievementFamily): string {
  switch (family) {
    case "volume":
      return m.gamification_family_volume();
    case "ritual":
      return m.gamification_family_ritual();
    case "exploration":
      return m.gamification_family_exploration();
    case "completion":
      return m.gamification_family_completion();
    case "seasonal":
      return m.gamification_family_seasonal();
    case "social":
      return m.gamification_family_social();
    case "account":
      return m.gamification_family_account();
    case "misc":
      return m.gamification_family_misc();
  }
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

export function groupIcon(group: AchievementGroup): IconName {
  return entryIcon(group.entries[0]);
}

/**
 * The one line of context under the tier ladder: where the user stands, and
 * what is left. Everything in it is derived from what the API returns — no
 * "unlocked on Twin Peaks S02E07"-style provenance exists in the data.
 */
export function contextNote(group: AchievementGroup): string {
  if (group.masked) return m.gamification_note_secret();

  const highest = group.entries.filter((e) => e.unlocked).at(-1);
  const parts: string[] = [];

  if (!highest || !highest.unlockedAt) {
    parts.push(m.gamification_note_never());
  } else if (highest.tier) {
    parts.push(
      m.gamification_note_unlocked_on({
        tier: tierLabel(highest.tier),
        date: formatDate(highest.unlockedAt),
      }),
    );
  } else {
    parts.push(
      m.gamification_note_unlocked_single({
        date: formatDate(highest.unlockedAt),
      }),
    );
  }

  const next = group.next;

  if (!next) {
    parts.push(m.gamification_note_complete());
  } else if (next.progress) {
    const count = formatNumber(next.progress.target - next.progress.current);
    parts.push(
      next.tier
        ? m.gamification_note_remaining({
            count,
            tier: tierLabel(next.tier),
          })
        : m.gamification_note_remaining_simple({ count }),
    );
  }

  return parts.join(" ");
}
