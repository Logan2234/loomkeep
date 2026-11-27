import type { MediaSummaryDto } from "@loomkeep/shared/contracts";
import type { CatalogSource, MediaType } from "@loomkeep/shared/enums";

export class MediaSummaryResponseDto implements MediaSummaryDto {
  source!: CatalogSource;
  sourceId!: string;
  type!: MediaType;
  title!: string;
  originalTitle?: string | null;
  year!: number | null;
  posterUrl!: string | null;
  isAdult!: boolean;
}
