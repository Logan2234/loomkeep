import type { RatingDto } from "@loomkeep/shared";
import { ErrorCode, GameSource, GameSummaryDto } from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../../common/app.exception";
import { chunk } from "../../common/array.util";
import { fetchJson } from "../../common/http.util";
import { QuotaTrackerService } from "../../common/quota-tracker.service";
import { RequestThrottle } from "../../common/request-throttle";
import type {
  GameCatalogProvider,
  ProviderGameDetails,
} from "./game-provider.types";

const OAUTH_URL = "https://id.twitch.tv/oauth2/token";
const API_URL = "https://api.igdb.com/v4";
const IMG = "https://images.igdb.com/igdb/image/upload";

// IGDB theme id for "Erotic" — our adult-content marker, mirroring TMDB `adult`
// / AniList hentai. See https://api-docs.igdb.com (themes reference).
const EROTIC_THEME_ID = 42;

// Refresh the app-access token a minute before it actually expires, so a call
// never rides on a token that lapses mid-flight.
const TOKEN_SKEW_MS = 60 * 1000;

// IGDB caps usage at 4 requests/second and 8 concurrent requests. Serialising
// to one request every 260ms (a small margin over the 250ms floor) satisfies
// both — there's never more than one in flight — shared instance-wide across
// every user of this self-hosted origin, same model as MusicBrainz.
const MIN_REQUEST_INTERVAL_MS = 260;

interface IgdbImage {
  image_id: string;
}

interface IgdbNamed {
  name: string;
}

interface IgdbWebsite {
  url: string;
  // Official site is category 1 (legacy) / type 1 (newer enum); IGDB is
  // migrating from `category` to `type`, so we read both.
  category?: number;
  type?: number;
}

interface IgdbInvolvedCompany {
  company?: IgdbNamed;
  developer?: boolean;
  publisher?: boolean;
}

interface IgdbFranchise {
  name: string;
  games?: IgdbGame[];
}

interface IgdbVideo {
  video_id: string;
  name?: string;
}

interface IgdbAgeRating {
  rating_cover_url?: string;
}

// One entry per platform the game supports; the boolean flags are OR-combined
// across entries since we don't display multiplayer modes per platform.
interface IgdbMultiplayerMode {
  campaigncoop?: boolean;
  onlinecoop?: boolean;
  offlinecoop?: boolean;
  splitscreen?: boolean;
  lancoop?: boolean;
}

interface IgdbGame {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  storyline?: string;
  first_release_date?: number; // Unix seconds.
  cover?: IgdbImage;
  artworks?: IgdbImage[];
  screenshots?: IgdbImage[];
  genres?: IgdbNamed[];
  platforms?: IgdbNamed[];
  themes?: number[];
  websites?: IgdbWebsite[];
  similar_games?: IgdbGame[];
  involved_companies?: IgdbInvolvedCompany[];
  game_modes?: IgdbNamed[];
  player_perspectives?: IgdbNamed[];
  franchises?: IgdbFranchise[];
  videos?: IgdbVideo[];
  age_ratings?: IgdbAgeRating[];
  multiplayer_modes?: IgdbMultiplayerMode[];
  // Both 0–100. `rating` is IGDB's own user-submitted score; `aggregated_rating`
  // is IGDB's aggregate of external critic reviews.
  rating?: number;
  aggregated_rating?: number;
  rating_count?: number;
  aggregated_rating_count?: number;
}

// IGDB computes this list itself (genre/theme/franchise co-occurrence); it can
// run long, so the detail page only shows the top handful.
const MAX_SIMILAR_GAMES = 10;

// Capped so the lightbox gallery stays a quick browse, not an endless scroll.
const MAX_SCREENSHOTS = 12;

interface TwitchToken {
  access_token: string;
  expires_in: number; // Seconds.
}

/**
 * Video games, from IGDB (Twitch/Amazon). IGDB authenticates through a Twitch
 * app-access token (OAuth client-credentials) and queries via Apicalypse — a
 * plain-text body POSTed to each endpoint. The token is cached until it nears
 * expiry.
 */
@Injectable()
export class IgdbProvider implements GameCatalogProvider {
  readonly source = GameSource.IGDB;

  private token: { value: string; expiresAt: number } | null = null;
  private readonly throttle = new RequestThrottle(MIN_REQUEST_INTERVAL_MS);

  constructor(
    private readonly configService: ConfigService,
    private readonly quota: QuotaTrackerService,
  ) {}

  // Reuses the same "mode prefix inside the free-text query" convention as
  // OpenLibraryProvider's `author:"…"` search — no separate mode param on
  // the search endpoint, just a self-contained convention this provider
  // parses. Unlike `author:`, these aren't upstream syntax IGDB understands
  // itself: `studio`/`genre` resolve to IGDB ids on a small side query
  // first, since Apicalypse has no single-string composite query form.
  private static readonly STUDIO_PREFIX = /^studio:"(.+)"$/i;
  private static readonly GENRE_PREFIX = /^genre:"(.+)"$/i;

  private static readonly SUMMARY_FIELDS =
    "name, cover.image_id, first_release_date, themes";

  async search(query: string): Promise<GameSummaryDto[]> {
    const studio = IgdbProvider.STUDIO_PREFIX.exec(query)?.[1];
    if (studio)
      return this.searchByInvolvement(
        "/companies",
        studio,
        "involved_companies.company",
      );

    const genre = IgdbProvider.GENRE_PREFIX.exec(query)?.[1];
    if (genre) return this.searchByInvolvement("/genres", genre, "genres");

    // Apicalypse strings are double-quoted; drop quotes from user input so they
    // cannot break out of the search literal.
    const safeQuery = query.replace(/"/g, "");
    // game_type = 0 keeps only base games (IGDB deprecated the old `category`
    // field; filtering on it silently returns nothing). Excludes DLC, bundles,
    // editions… so the searched title isn't buried under its re-releases.
    const games = await this.query<IgdbGame[]>(
      "/games",
      `search "${safeQuery}"; fields ${IgdbProvider.SUMMARY_FIELDS}; where game_type = 0; limit 20;`,
    );
    return games.map((g) => this.toSummary(g));
  }

  /**
   * Games by studio or genre: resolve the typed name to matching ids on a
   * name-searchable side entity (`/companies`, `/genres`) first, then filter
   * games by that field — the whole query is the studio/genre name, not a
   * title to text-match, same as "par auteur" replacing title search for
   * books. `sort rating desc` gives a reasonable order since there's no
   * `search` relevance score to sort by once the query is a filter, not text.
   */
  private async searchByInvolvement(
    entityPath: string,
    name: string,
    gameWhereField: string,
  ): Promise<GameSummaryDto[]> {
    const safeName = name.replace(/"/g, "");
    const matches = await this.query<{ id: number }[]>(
      entityPath,
      `search "${safeName}"; fields name; limit 5;`,
    );
    if (matches.length === 0) return [];

    const ids = matches.map((m) => m.id).join(",");
    const games = await this.query<IgdbGame[]>(
      "/games",
      `fields ${IgdbProvider.SUMMARY_FIELDS}; where game_type = 0 & ${gameWhereField} = (${ids}); sort rating desc; limit 20;`,
    );
    return games.map((g) => this.toSummary(g));
  }

  private static readonly DETAIL_FIELDS =
    "name, slug, summary, storyline, first_release_date, cover.image_id, artworks.image_id, screenshots.image_id, genres.name, platforms.name, themes, websites.url, websites.category, websites.type, " +
    "similar_games.name, similar_games.cover.image_id, similar_games.first_release_date, similar_games.themes, " +
    "involved_companies.company.name, involved_companies.developer, involved_companies.publisher, " +
    "game_modes.name, player_perspectives.name, " +
    "franchises.name, franchises.games.name, franchises.games.cover.image_id, franchises.games.first_release_date, franchises.games.themes, " +
    "videos.video_id, videos.name, age_ratings.rating_cover_url, " +
    "multiplayer_modes.campaigncoop, multiplayer_modes.onlinecoop, multiplayer_modes.offlinecoop, multiplayer_modes.splitscreen, multiplayer_modes.lancoop, " +
    "rating, rating_count, aggregated_rating, aggregated_rating_count";

  async getDetails(sourceId: string): Promise<ProviderGameDetails> {
    const games = await this.query<IgdbGame[]>(
      "/games",
      `fields ${IgdbProvider.DETAIL_FIELDS}; where id = ${Number(sourceId)};`,
    );
    const game = games[0];

    if (!game) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.CatalogItemNotFound,
        undefined,
        "Game not found on IGDB",
      );
    }

    return this.toDetails(game);
  }

  /**
   * Batch details for many IGDB ids in one query each 500 (IGDB's result cap),
   * used by the Steam import so a large library is persisted in a couple of
   * calls instead of one per game.
   */
  async getDetailsByIds(ids: string[]): Promise<ProviderGameDetails[]> {
    const details: ProviderGameDetails[] = [];

    for (const batch of chunk(ids, 500)) {
      const idList = batch.map((id) => Number(id)).join(",");
      const games = await this.query<IgdbGame[]>(
        "/games",
        `fields ${IgdbProvider.DETAIL_FIELDS}; where id = (${idList}); limit 500;`,
      );
      details.push(...games.map((g) => this.toDetails(g)));
    }

    return details;
  }

  /**
   * Map Steam appids to IGDB ids via IGDB's external_games cross-reference.
   * (`external_game_source = 1` is Steam; the old `category` field is
   * deprecated and silently returns nothing.) Returns appid → IGDB id.
   */
  async matchSteamAppIds(appIds: string[]): Promise<Map<string, string>> {
    const byAppId = new Map<string, string>();

    for (const batch of chunk(appIds, 500)) {
      const uidList = batch.map((id) => `"${id}"`).join(",");
      const rows = await this.query<{ game: number; uid: string }[]>(
        "/external_games",
        `fields game, uid; where external_game_source = 1 & uid = (${uidList}); limit 500;`,
      );

      for (const row of rows) {
        // First match wins; IGDB can list several rows per game/appid.
        if (!byAppId.has(row.uid)) byAppId.set(row.uid, String(row.game));
      }
    }

    return byAppId;
  }

  private toDetails(game: IgdbGame): ProviderGameDetails {
    return {
      summary: this.toSummary(game),
      overview: game.summary ?? null,
      backdropUrl: game.artworks?.[0]
        ? `${IMG}/t_1080p/${game.artworks[0].image_id}.jpg`
        : null,
      screenshots: (game.screenshots ?? [])
        .slice(0, MAX_SCREENSHOTS)
        .map((s) => `${IMG}/t_1080p/${s.image_id}.jpg`),
      genres: game.genres?.map((g) => g.name) ?? [],
      platforms: game.platforms?.map((p) => p.name) ?? [],
      releaseDate: game.first_release_date
        ? new Date(game.first_release_date * 1000).toISOString()
        : null,
      website:
        game.websites?.find((w) => w.category === 1 || w.type === 1)?.url ??
        null,
      similarGames: (game.similar_games ?? [])
        .slice(0, MAX_SIMILAR_GAMES)
        .map((g) => this.toSummary(g)),
      developers: uniqueCompanyNames(game.involved_companies, "developer"),
      publishers: uniqueCompanyNames(game.involved_companies, "publisher"),
      gameModes: game.game_modes?.map((m) => m.name) ?? [],
      playerPerspectives: game.player_perspectives?.map((p) => p.name) ?? [],
      franchiseGames: this.franchiseGames(game),
      franchiseName: game.franchises?.[0]?.name ?? null,
      ratings: toRatings(game),
      externalIds: [{ source: GameSource.IGDB, externalId: String(game.id) }],
      storyline: game.storyline ?? null,
      trailerVideoId: pickTrailer(game.videos),
      ageRatingImageUrls: uniqueAgeRatingImages(game.age_ratings),
      multiplayerModes: multiplayerModeLabels(game.multiplayer_modes),
    };
  }

  /**
   * Games from the same franchise(s), across all franchises the game belongs
   * to, excluding itself and de-duplicated (a game can appear in more than
   * one franchise's list). Uncapped — franchise rosters are small enough
   * (tens of entries at most) that showing all of them is cheap.
   */
  private franchiseGames(game: IgdbGame): GameSummaryDto[] {
    const seen = new Set<number>([game.id]);
    const games: GameSummaryDto[] = [];

    for (const franchise of game.franchises ?? []) {
      for (const mate of franchise.games ?? []) {
        if (seen.has(mate.id)) continue;
        seen.add(mate.id);
        games.push(this.toSummary(mate));
      }
    }

    return games;
  }

  private toSummary(game: IgdbGame): GameSummaryDto {
    return {
      source: GameSource.IGDB,
      sourceId: String(game.id),
      title: game.name,
      year: game.first_release_date
        ? new Date(game.first_release_date * 1000).getUTCFullYear()
        : null,
      coverUrl: game.cover
        ? `${IMG}/t_cover_big/${game.cover.image_id}.jpg`
        : null,
      isAdult: game.themes?.includes(EROTIC_THEME_ID) ?? false,
    };
  }

  /** POST an Apicalypse query to an IGDB endpoint with a valid access token. */
  private async query<T>(path: string, body: string): Promise<T> {
    await this.throttle.wait();
    this.quota.record("igdb");
    return fetchJson<T>(
      `${API_URL}${path}`,
      {
        method: "POST",
        headers: {
          "Client-ID":
            this.configService.getOrThrow<string>("TWITCH_CLIENT_ID"),
          Authorization: `Bearer ${await this.accessToken()}`,
          Accept: "application/json",
        },
        body,
      },
      { sourceLabel: "IGDB" },
    );
  }

  /** Cached Twitch app-access token, fetched (or refreshed) on demand. */
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - TOKEN_SKEW_MS > Date.now()) {
      return this.token.value;
    }

    const url = new URL(OAUTH_URL);
    url.searchParams.set(
      "client_id",
      this.configService.getOrThrow<string>("TWITCH_CLIENT_ID"),
    );
    url.searchParams.set(
      "client_secret",
      this.configService.getOrThrow<string>("TWITCH_CLIENT_SECRET"),
    );
    url.searchParams.set("grant_type", "client_credentials");

    const token = await fetchJson<TwitchToken>(
      url,
      { method: "POST" },
      { sourceLabel: "Twitch token" },
    );
    this.token = {
      value: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    };
    return this.token.value;
  }
}

/** IGDB's own user rating + critic aggregate (both 0–100), when present. */
function toRatings(game: IgdbGame): RatingDto[] {
  const ratings: RatingDto[] = [];
  const url = game.slug ? `https://www.igdb.com/games/${game.slug}` : undefined;

  if (game.rating !== null && game.rating !== undefined) {
    ratings.push({
      source: "IGDB",
      score: `${Math.round(game.rating)}%${voteSuffix(game.rating_count)}`,
      url,
    });
  }

  if (game.aggregated_rating !== null && game.aggregated_rating !== undefined) {
    ratings.push({
      source: "Critiques",
      score: `${Math.round(game.aggregated_rating)}%${voteSuffix(game.aggregated_rating_count)}`,
      url,
    });
  }

  return ratings;
}

function voteSuffix(count: number | undefined): string {
  return count ? ` (${count})` : "";
}

/** Prefer a video whose name mentions "trailer"; else the first IGDB lists. */
function pickTrailer(videos: IgdbVideo[] | undefined): string | null {
  if (!videos || videos.length === 0) return null;
  const trailer = videos.find((v) => /trailer/i.test(v.name ?? ""));
  return (trailer ?? videos[0]).video_id;
}

/** Age rating badge images (ESRB/PEGI/…), normalised to absolute URLs. */
function uniqueAgeRatingImages(ratings: IgdbAgeRating[] | undefined): string[] {
  const urls = (ratings ?? [])
    .map((r) => r.rating_cover_url)
    .filter((url): url is string => !!url)
    .map((url) => (url.startsWith("//") ? `https:${url}` : url));
  return [...new Set(urls)];
}

/**
 * Human-readable multiplayer modes, OR-combined across IGDB's per-platform
 * entries. Left in English to match the untranslated style of the other
 * catalog fields (genres, platforms, game modes all pass through as-is).
 */
function multiplayerModeLabels(
  modes: IgdbMultiplayerMode[] | undefined,
): string[] {
  const any = (key: keyof IgdbMultiplayerMode) =>
    (modes ?? []).some((m) => m[key]);
  const labels: string[] = [];
  if (any("campaigncoop")) labels.push("Campaign co-op");
  if (any("onlinecoop")) labels.push("Online co-op");
  if (any("offlinecoop")) labels.push("Local co-op");
  if (any("splitscreen")) labels.push("Split screen");
  if (any("lancoop")) labels.push("LAN co-op");
  return labels;
}

/** Distinct company names with the given role (developer/publisher), in order. */
function uniqueCompanyNames(
  companies: IgdbInvolvedCompany[] | undefined,
  role: "developer" | "publisher",
): string[] {
  const names = (companies ?? [])
    .filter((c) => c[role] && c.company?.name)
    .map((c) => c.company!.name);
  return [...new Set(names)];
}
