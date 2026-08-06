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
  /** IGDB's own user rating + critic aggregate, when known. */
  ratings: RatingDto[];
  externalIds: ProviderGameExternalId[];
}

export interface GameCatalogProvider {
  readonly source: GameSource;
  search(query: string): Promise<GameSummaryDto[]>;
  getDetails(sourceId: string): Promise<ProviderGameDetails>;
}
