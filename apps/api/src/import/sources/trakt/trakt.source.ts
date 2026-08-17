import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { QuotaTrackerService } from "../../../common/quota-tracker.service";
import { MediaItemService } from "../../../catalog/media-item.service";
import { TmdbProvider } from "../../../catalog/providers/tmdb.provider";
import { PrismaService } from "../../../prisma/prisma.service";
import type { ParsedImport } from "../../media-import-model";
import { MediaImportSource } from "../media/media-import.source";
import { buildImportMovies, buildImportShows } from "./parse-trakt";
import type {
  TraktWatchedMovie,
  TraktWatchedShow,
  TraktWatchlistMovieItem,
  TraktWatchlistShowItem,
} from "./trakt-api.types";

const TRAKT_API = "https://api.trakt.tv";

/** Parse model: the raw username, filled in with the fetched export by {@link load}. */
interface TraktParsed extends ParsedImport {
  username: string;
}

/**
 * Trakt import: unlike TV Time's file export, Trakt exposes a public REST API
 * per user — `GET /users/{id}/watched|watchlist/{shows,movies}` — so there is
 * nothing to upload, only a username. Those endpoints are OAuth-optional:
 * they work with just the app's `trakt-api-key` as long as the target
 * profile's history/watchlist are public, exactly like the Steam import only
 * works against a public profile. Movies and (crucially) shows already carry
 * a TMDB id, so reconciliation is direct rather than TV Time's TVDB lookup.
 */
@Injectable()
export class TraktImportSource extends MediaImportSource<TraktParsed> {
  readonly id = "trakt";
  readonly requiredEnvKeys = ["TRAKT_CLIENT_ID"];

  constructor(
    prisma: PrismaService,
    mediaItemService: MediaItemService,
    tmdb: TmdbProvider,
    private readonly configService: ConfigService,
    private readonly quota: QuotaTrackerService,
  ) {
    super(prisma, mediaItemService, tmdb);
  }

  parseInput(input: string): TraktParsed {
    return { source: this.id, username: input.trim(), shows: [], movies: [] };
  }

  protected async load(parsed: TraktParsed): Promise<void> {
    const user = encodeURIComponent(parsed.username);
    const [watchedShows, watchedMovies, watchlistShows, watchlistMovies] =
      await Promise.all([
        this.getJson<TraktWatchedShow[]>(`/users/${user}/watched/shows`),
        this.getJson<TraktWatchedMovie[]>(`/users/${user}/watched/movies`),
        this.getJson<TraktWatchlistShowItem[]>(
          `/users/${user}/watchlist/shows`,
        ),
        this.getJson<TraktWatchlistMovieItem[]>(
          `/users/${user}/watchlist/movies`,
        ),
      ]);

    parsed.shows = buildImportShows(watchedShows, watchlistShows);
    parsed.movies = buildImportMovies(watchedMovies, watchlistMovies);
  }

  private async getJson<T>(path: string): Promise<T> {
    this.quota.record("trakt");
    const response = await fetch(`${TRAKT_API}${path}`, {
      headers: {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key":
          this.configService.getOrThrow<string>("TRAKT_CLIENT_ID"),
      },
    });

    // A nonexistent user and a private profile both come back as 404 — Trakt
    // never distinguishes them for an unauthenticated caller.
    if (response.status === 404 || response.status === 401) {
      throw new BadRequestException(
        "Profil Trakt introuvable ou privé — ton historique et ta watchlist doivent être publics (Réglages > Vie privée sur trakt.tv).",
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `Trakt request failed with status ${response.status}`,
      );
    }

    return (await response.json()) as T;
  }
}
