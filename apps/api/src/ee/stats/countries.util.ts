import { type VideoCountryDto } from "@loomkeep/shared/contracts";
import { runtimeFor } from "@loomkeep/shared/rules";
import type { VideoInput } from "../../stats/advanced-stats.source";

/**
 * Titles and watch time per country of origin: a series counts once however
 * many of its episodes were watched, a co-production once for each country.
 * Titles TMDB gives no country stay out.
 */
export function computeCountries(
  episodeWatches: VideoInput["episodeWatches"],
  completedMovies: VideoInput["completedMovies"],
): VideoCountryDto[] {
  const byCountry = new Map<string, { items: Set<string>; minutes: number }>();

  const add = (country: string, mediaItemId: string, minutes: number): void => {
    const row = byCountry.get(country) ?? { items: new Set(), minutes: 0 };
    row.items.add(mediaItemId);
    row.minutes += minutes;
    byCountry.set(country, row);
  };

  for (const w of episodeWatches) {
    for (const country of w.originCountries) {
      add(country, w.mediaItemId, w.minutes);
    }
  }

  for (const m of completedMovies) {
    const minutes = runtimeFor("MOVIE", m.runtimeMin) * m.viewings;

    for (const country of m.originCountries) {
      add(country, m.mediaItemId, minutes);
    }
  }

  return [...byCountry.entries()]
    .map(([country, row]) => ({
      country,
      titles: row.items.size,
      minutes: row.minutes,
    }))
    .sort((a, b) => b.titles - a.titles || b.minutes - a.minutes);
}
