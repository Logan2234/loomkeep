import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RatingDto } from "@loomkeep/shared";
import { QuotaTrackerService } from "../common/quota-tracker.service";

const OMDB_URL = "https://www.omdbapi.com/";

/** Maps OMDb's verbose rating source names to our short labels. */
const SOURCE_LABELS: Record<string, string> = {
  "Internet Movie Database": "IMDb",
  "Rotten Tomatoes": "RT",
  Metacritic: "Metacritic",
};

interface OmdbResponse {
  Response: string;
  Ratings?: { Source: string; Value: string }[];
}

/**
 * OMDb aggregates IMDb + Rotten Tomatoes + Metacritic scores from an IMDb id.
 * Requires OMDB_API_KEY; without it (or on any failure) this returns an empty
 * list so the caller degrades silently — ratings are a nice-to-have.
 */
@Injectable()
export class OmdbService {
  constructor(
    private readonly config: ConfigService,
    private readonly quota: QuotaTrackerService,
  ) {}

  async getRatings(imdbId: string | null): Promise<RatingDto[]> {
    const apiKey = this.config.get<string>("OMDB_API_KEY");
    if (!apiKey || !imdbId) return [];

    try {
      const url = new URL(OMDB_URL);
      url.searchParams.set("apikey", apiKey);
      url.searchParams.set("i", imdbId);
      this.quota.record("omdb");
      const response = await fetch(url);
      if (!response.ok) return [];

      const data = (await response.json()) as OmdbResponse;
      if (data.Response !== "True" || !data.Ratings) return [];

      return data.Ratings.map((r) => {
        const source = SOURCE_LABELS[r.Source] ?? r.Source;
        // Only IMDb has a deducible per-title URL (from the id we queried with);
        // RT/Metacritic expose no reliable deep link.
        const url =
          source === "IMDb"
            ? `https://www.imdb.com/title/${imdbId}/`
            : undefined;
        return { source, score: r.Value, ...(url ? { url } : {}) };
      });
    } catch {
      return []; // network / parse hiccup → no ratings, no error
    }
  }
}
