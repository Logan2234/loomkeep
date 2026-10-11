import type { ApiV1WorkDto, MediaType, StatsDomain } from "@loomkeep/shared";

import { MediaType as MediaTypeValues, STATS_DOMAINS } from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
export class ApiV1WorkResponseDto implements ApiV1WorkDto {
  /**
   * Loomkeep's own id for the work, the same for every account.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * The domain the work belongs to.
   * @example "MEDIA"
   */
  @ApiProperty({ enum: STATS_DOMAINS })
  domain!: StatsDomain;

  /**
   * MOVIE, SERIES or ANIME for video; null in the other domains.
   * @example "SERIES"
   */
  @ApiProperty({ enum: Object.values(MediaTypeValues), nullable: true })
  type!: MediaType | null;

  /**
   * The title, in the language asked for when a translation exists (see
   * `lang`).
   * @example "Severance"
   */
  title!: string;

  /**
   * Book authors or album artists; empty for video and games.
   * @example []
   */
  creators!: string[];

  /**
   * Poster or cover image; null when the catalogue has none.
   * @example "https://image.tmdb.org/t/p/w500/lFf6LLrQjYldcZItzOkGmMMigP7.jpg"
   */
  coverUrl!: string | null;

  /**
   * The catalogue the work comes from: TMDB, ANILIST, IGDB, OPEN_LIBRARY or
   * MUSICBRAINZ.
   * @example "TMDB"
   */
  source!: string;

  /**
   * The work's id in that catalogue.
   * @example "95396"
   */
  sourceId!: string;

  /**
   * The work's page in the Loomkeep web app.
   * @example "https://loomkeep.app/app/media/series/95396"
   */
  url!: string;
}
