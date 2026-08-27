import type { GameSource, GameSummaryDto, RatingDto } from "@loomkeep/shared";

interface ProviderGameExternalId {
  source: GameSource;
  externalId: string;
}

/** Everything a provider knows about one game, in canonical form. */
export interface ProviderGameDetails {
  summary: GameSummaryDto;
  overview: string | null;
  backdropUrl: string | null;
  /** Screenshot gallery (IGDB), for the detail page's lightbox carousel. */
  screenshots: string[];
  genres: string[];
  platforms: string[];
  releaseDate: string | null;
  website: string | null;
  similarGames: GameSummaryDto[];
  developers: string[];
  publishers: string[];
  gameModes: string[];
  playerPerspectives: string[];
  /** Other games from the same franchise(s), excluding this one. */
  franchiseGames: GameSummaryDto[];
  /** Name of the first franchise this game belongs to, when known. */
  franchiseName: string | null;
  /** IGDB's own user rating + critic aggregate, when known. */
  ratings: RatingDto[];
  externalIds: ProviderGameExternalId[];
  /** Deeper narrative summary, distinct from `overview`, when IGDB has one. */
  storyline: string | null;
  /** YouTube video id for a trailer, when IGDB lists one. */
  trailerVideoId: string | null;
  /** Age rating badge images (ESRB/PEGI/…), when IGDB has classified the game. */
  ageRatingImageUrls: string[];
  /** Multiplayer modes beyond the generic `gameModes` (co-op, split screen…). */
  multiplayerModes: string[];
}

export interface GameCatalogProvider {
  readonly source: GameSource;
  search(query: string): Promise<GameSummaryDto[]>;
  getDetails(sourceId: string): Promise<ProviderGameDetails>;
}
