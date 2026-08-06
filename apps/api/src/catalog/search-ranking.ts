import type { MediaSummaryDto } from "@loomkeep/shared";

/** Lowercase, strip diacritics and surrounding space for loose title matching. */
function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Title-match score against the query (higher = better):
 * 4 exact · 3 starts-with · 2 whole-word · 1 substring · 0 none.
 * Both the localized and the original title are considered.
 */
export function relevanceScore(media: MediaSummaryDto, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const wholeWord = new RegExp(`\\b${escapeRegExp(q)}\\b`);
  const titles = [media.title, media.originalTitle]
    .filter((t): t is string => !!t)
    .map(normalize);

  let best = 0;

  for (const t of titles) {
    if (t === q) best = Math.max(best, 4);
    else if (t.startsWith(q)) best = Math.max(best, 3);
    else if (wholeWord.test(t)) best = Math.max(best, 2);
    else if (t.includes(q)) best = Math.max(best, 1);
  }

  return best;
}

/**
 * Rank results by title relevance (best first). Ties keep their input order,
 * which already reflects each source's own popularity ordering.
 */
export function rankBySearchRelevance(
  results: MediaSummaryDto[],
  query: string,
): MediaSummaryDto[] {
  return results
    .map((media, index) => ({
      media,
      index,
      score: relevanceScore(media, query),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.media);
}
