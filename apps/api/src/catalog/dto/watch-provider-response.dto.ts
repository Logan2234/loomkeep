import type { WatchProviderDto } from "@loomkeep/shared";

export class WatchProviderResponseDto implements WatchProviderDto {
  name!: string;
  logoUrl!: string | null;
}
