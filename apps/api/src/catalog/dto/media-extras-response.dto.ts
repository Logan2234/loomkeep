import type { MediaExtrasDto } from "@loomkeep/shared";
import { CastMemberResponseDto } from "./cast-member-response.dto";
import { CreatorRefResponseDto } from "./creator-ref-response.dto";
import { ExternalLinkResponseDto } from "./external-link-response.dto";
import { MediaSummaryResponseDto } from "./media-summary-response.dto";
import { RatingResponseDto } from "./rating-response.dto";
import { WatchProvidersResponseDto } from "./watch-providers-response.dto";

export class MediaExtrasResponseDto implements MediaExtrasDto {
  watchProviders!: WatchProvidersResponseDto;
  cast!: CastMemberResponseDto[];
  similar!: MediaSummaryResponseDto[];
  ratings!: RatingResponseDto[];
  images!: string[];
  tagline!: string | null;
  directors!: string[];
  directorRefs!: CreatorRefResponseDto[];
  productionCompanyRefs!: CreatorRefResponseDto[];
  networkRefs!: CreatorRefResponseDto[];
  trailerVideoId!: string | null;
  contentRating!: string | null;
  studios!: string[];
  studioRefs!: CreatorRefResponseDto[];
  format!: string | null;
  season!: string | null;
  relations!: MediaSummaryResponseDto[];
  externalLinks!: ExternalLinkResponseDto[];
  tags!: string[];
}
