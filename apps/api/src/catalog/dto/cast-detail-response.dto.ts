import type { CastDetailDto } from "@loomkeep/shared";
import { MediaSummaryResponseDto } from "./media-summary-response.dto";

export class CastDetailResponseDto implements CastDetailDto {
  name!: string;
  photoUrl!: string | null;
  subtitle!: string | null;
  description!: string | null;
  knownFor!: MediaSummaryResponseDto[];
  imdbId!: string | null;
  wikidataId!: string | null;
  homepage!: string | null;
}
