import type { WatchProvidersDto } from "@loomkeep/shared/contracts";
import { WatchProviderResponseDto } from "./watch-provider-response.dto";

export class WatchProvidersResponseDto implements WatchProvidersDto {
  region!: string;
  flatrate!: WatchProviderResponseDto[];
  free!: WatchProviderResponseDto[];
  ads!: WatchProviderResponseDto[];
  rent!: WatchProviderResponseDto[];
  buy!: WatchProviderResponseDto[];
  link!: string | null;
}
