import type {
  DataExportList,
  DataExportListItem,
  ListKind,
  ListVisibility,
  ReviewTargetType,
} from "@loomkeep/shared";

class DataExportListItemResponseDto implements DataExportListItem {
  /**
   * A work, a SEASON or an EPISODE.
   * @example "BOOK"
   */
  targetType!: ReviewTargetType;

  /**
   * Its Loomkeep id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  targetId!: string;

  /**
   * Its place in the list, from 0.
   * @example 0
   */
  position!: number;

  /**
   * When it was added.
   * @example "2026-09-30T21:00:00.000Z"
   */
  addedAt!: string;
}

export class DataExportListResponseDto implements DataExportList {
  /**
   * The list's name.
   * @example "Sci-fi to watch together"
   */
  title!: string;

  /**
   * Its description.
   * @example "Picked with Julie"
   */
  description!: string | null;

  /**
   * RANKED (a top 10) or COLLECTION (an unordered set).
   * @example "COLLECTION"
   */
  kind!: ListKind;

  /**
   * Who can see it.
   * @example "FRIENDS"
   */
  visibility!: ListVisibility;

  /**
   * When it was created.
   * @example "2026-03-14T09:26:53.000Z"
   */
  createdAt!: string;

  /**
   * When it last changed.
   * @example "2026-09-30T21:00:00.000Z"
   */
  updatedAt!: string;

  /** Its items, in order. */
  items!: DataExportListItemResponseDto[];
}
