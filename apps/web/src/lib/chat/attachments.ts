import { formatNumber } from "#lib/format.js";
import { m } from "#lib/paraglide/messages.js";
import {
  episodeCode,
  type MyListDto,
  type MyReviewDto,
  type ReviewTargetSummaryDto,
} from "@loomkeep/shared";

const fold = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** What `/review` or `/list` offers for the query typed after it. */
export function matchingTitle(title: string, query: string): boolean {
  return fold(title).includes(fold(query.trim()));
}

/** "Severance · Saison 2" or "Severance · S02E05" for a season's or an episode's review. */
export function reviewedTitle(target: ReviewTargetSummaryDto): string {
  const season = target.seasonNumber ?? null;
  const episode = target.episodeNumber ?? null;
  if (season === null) return target.title;
  const at =
    episode === null
      ? `${m.common_season()} ${season}`
      : episodeCode(season, episode);
  return `${target.title} · ${at}`;
}

export function ratingLabel(rating: number): string {
  return formatNumber(rating, { maximumFractionDigits: 1 });
}

/** The reviews `/review` offers: the viewer's own, about a work still known. */
export function reviewChoices(
  reviews: MyReviewDto[],
  query: string,
): (MyReviewDto & { target: ReviewTargetSummaryDto })[] {
  return reviews.filter(
    (review): review is MyReviewDto & { target: ReviewTargetSummaryDto } =>
      review.target !== null && matchingTitle(review.target.title, query),
  );
}

/**
 * A PRIVATE list stays out of a conversation: only its owner and editors may
 * open it. Any other refusal (a list someone else owns) comes from the API.
 */
export function listShareable(list: MyListDto): boolean {
  return list.visibility !== "PRIVATE";
}
