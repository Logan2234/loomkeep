import type {
  DataExportVisibilitySetting,
  Domain,
  VisibilityAudience,
  VisibilityFacet,
} from "@loomkeep/shared";

export class DataExportVisibilitySettingResponseDto implements DataExportVisibilitySetting {
  domain!: Domain;
  facet!: VisibilityFacet;
  audience!: VisibilityAudience;
}
