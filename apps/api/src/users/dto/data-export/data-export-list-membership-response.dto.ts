import type { DataExportListMembership } from "@loomkeep/shared";

export class DataExportListMembershipResponseDto implements DataExportListMembership {
  /**
   * A list the account can edit without owning it.
   * @example "Movie night"
   */
  listTitle!: string;

  /**
   * Its owner.
   * @example "max"
   */
  listOwnerUsername!: string;

  /**
   * When the account was added as an editor.
   * @example "2026-09-30T21:00:00.000Z"
   */
  createdAt!: string;
}
