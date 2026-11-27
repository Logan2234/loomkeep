import type { VisibilitySettingItemDto } from "@loomkeep/shared/contracts";
import type {
  Domain,
  VisibilityAudience,
  VisibilityFacet,
} from "@loomkeep/shared/enums";

export class VisibilitySettingItemResponseDto implements VisibilitySettingItemDto {
  domain!: Domain;
  facet!: VisibilityFacet;
  audience!: VisibilityAudience;
}
