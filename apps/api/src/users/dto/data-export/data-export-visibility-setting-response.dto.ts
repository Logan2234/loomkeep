import type {
  Domain,
  VisibilityAudience,
  VisibilityFacet,
} from "@loomkeep/shared/enums";
import type { DataExportVisibilitySetting } from "../../../account/data-export.types";

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
