import type {
  CatalogSource,
  MediaSummaryDto,
  MediaType,
} from "@loomkeep/shared";

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
