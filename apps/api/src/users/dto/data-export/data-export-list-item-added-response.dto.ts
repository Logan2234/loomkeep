import type {
  DataExportListItemAdded,
  ReviewTargetType,
} from "@loomkeep/shared";

export class DataExportListItemAddedResponseDto implements DataExportListItemAdded {
  /**
   * The list it was added to.
   * @example "À voir ensemble"
   */
  listTitle!: string;

  /**
   * Who owns that list.
   * @example "camille"
   */
  listOwnerUsername!: string;

  /**
   * What kind of work it is.
   * @example "MEDIA"
   */
  targetType!: ReviewTargetType;

  /**
   * The work's id in Loomkeep.
   * @example "cm1abc2def3ghi4jkl5mno6pq"
   */
  targetId!: string;

  /**
   * When it was added.
   * @example "2026-05-01T18:00:00.000Z"
   */
  addedAt!: string;
}
