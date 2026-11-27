import type { MediaItemDto } from "@loomkeep/shared/contracts";
import type { CatalogSource, MediaType } from "@loomkeep/shared/enums";

export class MediaItemResponseDto implements MediaItemDto {
  upcoming?: boolean;
  id!: string;
  type!: MediaType;
  title!: string;
  posterUrl!: string | null;
  canonicalSource!: CatalogSource;
  sourceId!: string;
}
