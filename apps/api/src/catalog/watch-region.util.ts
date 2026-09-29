// The instance is French-first: with nothing better to go on, offers are France's.
const FALLBACK_REGION = "FR";

const REGION_RE = /^[A-Z]{2}$/;

/**
 * The country whose streaming offers to show: the one the user picked, else
 * the country of their browser's preferred language ("fr-BE" → BE), else
 * France. A bare language ("fr", "en") names no country, so it falls back too
 * rather than guessing one ("en" could as well be GB as US).
 */
export function resolveWatchRegion(
  picked: string | undefined,
  acceptLanguage: string | undefined,
): string {
  if (picked && REGION_RE.test(picked)) return picked;

  const preferred = acceptLanguage?.split(",")[0]?.split(";")[0]?.trim();
  const region = preferred?.split("-")[1]?.toUpperCase();
  return region && REGION_RE.test(region) ? region : FALLBACK_REGION;
}
