import type { WatchProvidersDto } from "@loomkeep/shared";
import { WatchProviderResponseDto } from "./watch-provider-response.dto";

export class WatchProvidersResponseDto implements WatchProvidersDto {
  flatrate!: WatchProviderResponseDto[];
  rent!: WatchProviderResponseDto[];
  buy!: WatchProviderResponseDto[];
  link!: string | null;
}
