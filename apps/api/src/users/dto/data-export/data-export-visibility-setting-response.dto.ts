import type {
  DataExportVisibilitySetting,
  Domain,
  VisibilityAudience,
  VisibilityFacet,
} from "@loomkeep/shared";

export class DataExportVisibilitySettingResponseDto implements DataExportVisibilitySetting {
  /**
   * The domain concerned.
   * @example "BOOKS"
   */
  domain!: Domain;

  /**
   * LIBRARY (what is tracked) or ACTIVITY (the feed).
   * @example "LIBRARY"
   */
  facet!: VisibilityFacet;

  /**
   * PUBLIC, FRIENDS or NONE.
   * @example "FRIENDS"
   */
  audience!: VisibilityAudience;
}
