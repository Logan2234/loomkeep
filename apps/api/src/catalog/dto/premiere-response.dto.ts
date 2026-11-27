import type { PremiereDto } from "@loomkeep/shared/contracts";

export class PremiereResponseDto implements PremiereDto {
  sourceId!: string;
  title!: string;
  originalTitle!: string | null;
  firstAirDate!: string;
  networkId!: number;
  networkName!: string;
  originCountries!: string[];
  overview!: string | null;
  posterUrl!: string;
  backdropUrl!: string | null;
  popularity!: number;
}
