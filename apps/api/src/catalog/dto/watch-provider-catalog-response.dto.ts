import type { WatchProviderCatalogDto } from "@loomkeep/shared";
import { WatchProviderResponseDto } from "./watch-provider-response.dto";

export class WatchProviderCatalogResponseDto implements WatchProviderCatalogDto {
  region!: string;
  regions!: string[];
  providers!: WatchProviderResponseDto[];
}
