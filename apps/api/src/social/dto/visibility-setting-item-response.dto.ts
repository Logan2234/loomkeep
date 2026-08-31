import type {
  Domain,
  VisibilityAudience,
  VisibilityFacet,
  VisibilitySettingItemDto,
} from "@loomkeep/shared";

export class VisibilitySettingItemResponseDto implements VisibilitySettingItemDto {
  domain!: Domain;
  facet!: VisibilityFacet;
  audience!: VisibilityAudience;
}
