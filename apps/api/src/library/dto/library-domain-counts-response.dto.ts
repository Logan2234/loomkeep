import type { LibraryDomainCountsDto } from "@loomkeep/shared";

export class LibraryDomainCountsResponseDto implements LibraryDomainCountsDto {
  MEDIA?: number;
  BOOKS?: number;
  GAMES?: number;
  MUSIC?: number;
  PODCASTS?: number;
  BOARDGAMES?: number;
}
