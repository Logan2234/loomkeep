import { m } from "#lib/paraglide/messages.js";
import type { MyReviewDto } from "@loomkeep/shared";

/** "Season 2" / "Season 2 · Episode 5" for a season or episode review, else null. */
export function seasonEpisodeLabel(review: MyReviewDto): string | null {
  const { seasonNumber, episodeNumber } = review.target ?? {};
  if (seasonNumber === null) return null;
  const season = `${m.common_season()} ${seasonNumber}`;
  return episodeNumber === null
    ? season
    : `${season} · ${m.common_episode()} ${episodeNumber}`;
}
