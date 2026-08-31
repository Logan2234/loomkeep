import type { ImportAvailabilityDto } from "@loomkeep/shared";

export class ImportAvailabilityResponseDto implements ImportAvailabilityDto {
  tvtime?: boolean;
  trakt?: boolean;
  letterboxd?: boolean;
  myanimelist?: boolean;
  simkl?: boolean;
  kitsu?: boolean;
  steam?: boolean;
  backloggd?: boolean;
  storygraph?: boolean;
  goodreads?: boolean;
  babelio?: boolean;
  librarything?: boolean;
  bookwyrm?: boolean;
  opml?: boolean;
  spotify?: boolean;
  boardgamegeek?: boolean;
}
