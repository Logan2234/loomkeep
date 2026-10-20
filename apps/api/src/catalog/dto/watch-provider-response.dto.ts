import type { WatchProviderDto } from "@loomkeep/shared";

export class WatchProviderResponseDto implements WatchProviderDto {
  id!: number;
  name!: string;
  logoUrl!: string | null;
}
