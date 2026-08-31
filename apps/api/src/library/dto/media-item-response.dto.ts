import type { CatalogSource, MediaItemDto, MediaType } from "@loomkeep/shared";

export class MediaItemResponseDto implements MediaItemDto {
  id!: string;
  type!: MediaType;
  title!: string;
  posterUrl!: string | null;
  canonicalSource!: CatalogSource;
  sourceId!: string;
}
