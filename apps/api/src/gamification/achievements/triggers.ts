import { XpReason } from "@loomkeep/shared";

/**
 * Which registry keys a live XP award site should re-evaluate right after
 * crediting XP for that reason. Reasons with no achievement depending on
 * them are simply absent.
 *
 * Achievements with no natural single-moment mutation (member_since_*,
 * anniversary, welcome_back, full_circle, hidden_gem, full_inventory,
 * no_favorites, double_life) are deliberately absent and stay nightly-only.
 */
export const ACHIEVEMENT_KEYS_BY_XP_REASON: Partial<
  Record<XpReason, string[]>
> = {
  EPISODE_WATCHED: [
    "first_episode",
    "episode_watcher_bronze",
    "episode_watcher_silver",
    "episode_watcher_gold",
    "marathon",
    "night_owl",
    "early_bird",
    "streak_bronze",
    "streak_silver",
    "streak_gold",
    "decades_bronze",
    "decades_silver",
    "decades_gold",
    "genres_bronze",
    "genres_silver",
    "genres_gold",
    "omnivore",
    "new_year_finish",
  ],
  MOVIE_WATCHED: [
    "cinephile_bronze",
    "cinephile_silver",
    "cinephile_gold",
    "worth_the_wait",
    "night_owl",
    "early_bird",
    "decades_bronze",
    "decades_silver",
    "decades_gold",
    "genres_bronze",
    "genres_silver",
    "genres_gold",
    "omnivore",
    "halloween",
    "contemporary",
    "new_year_finish",
  ],
  SERIES_COMPLETED: [
    "series_finisher_bronze",
    "series_finisher_silver",
    "series_finisher_gold",
    "worth_the_wait",
    "decades_bronze",
    "decades_silver",
    "decades_gold",
    "genres_bronze",
    "genres_silver",
    "genres_gold",
    "omnivore",
    "big_screen",
    "well_rounded",
    "guilty_pleasure",
    "new_year_finish",
    "phoenix",
  ],
  GAME_FINISHED: [
    "game_finisher_bronze",
    "game_finisher_silver",
    "game_finisher_gold",
    "hours_played_bronze",
    "hours_played_silver",
    "hours_played_gold",
    "worth_the_wait",
    "decades_bronze",
    "decades_silver",
    "decades_gold",
    "genres_bronze",
    "genres_silver",
    "genres_gold",
    "omnivore",
    "well_rounded",
    "new_year_finish",
    "phoenix",
  ],
  SAGA_COMPLETED: [
    "saga_finisher_bronze",
    "saga_finisher_silver",
    "saga_finisher_gold",
  ],
  BOOK_FINISHED: [
    "book_finisher_bronze",
    "book_finisher_silver",
    "book_finisher_gold",
    "pages_reader_bronze",
    "pages_reader_silver",
    "pages_reader_gold",
    "worth_the_wait",
    "decades_bronze",
    "decades_silver",
    "decades_gold",
    "genres_bronze",
    "genres_silver",
    "genres_gold",
    "omnivore",
    "well_rounded",
    "new_year_finish",
    "phoenix",
  ],
};

// Non-XP live keys are evaluated by name rather than via
// ACHIEVEMENT_KEYS_BY_XP_REASON — these live sites don't credit any
// XpReason the engine dispatches on, or need to react before an XP award
// happens.
export const ACHIEVEMENT_KEYS_ON_FOLLOW_ACCEPTED = [
  "has_friends",
  "one_sided",
  "followers_bronze",
  "followers_silver",
  "followers_gold",
];

export const ACHIEVEMENT_KEYS_ON_TOTP_ENABLED = ["locked_down"];

export const ACHIEVEMENT_KEYS_ON_COMMENT_POSTED = [
  "first_comment",
  "chatterbox_bronze",
  "chatterbox_silver",
  "chatterbox_gold",
  "icebreaker",
];

export const ACHIEVEMENT_KEYS_ON_REVIEW_WRITTEN = ["first_take"];

export const ACHIEVEMENT_KEYS_ON_REVIEW_VOTE_UP = [
  "crowd_favorite",
  "standing_ovation",
];

export const ACHIEVEMENT_KEYS_ON_LIST_CREATED = [
  "first_list",
  "curator_bronze",
  "curator_silver",
  "curator_gold",
];

export const ACHIEVEMENT_KEYS_ON_IMPORT_COMPLETED = ["fresh_start"];
