import type { ApiV1ListDto, ListKind, ListVisibility } from "@loomkeep/shared";

import {
  ListKind as ListKindValues,
  ListVisibility as ListVisibilityValues,
} from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
export class ApiV1ListResponseDto implements ApiV1ListDto {
  /**
   * The list's id, for `GET /v1/lists/{id}`.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * The list's name.
   * @example "Sci-fi to watch together"
   */
  title!: string;

  /**
   * The list's description, if any.
   * @example "Picked with Julie"
   */
  description!: string | null;

  /**
   * RANKED shows its items in rank order (a top 10), COLLECTION as an
   * unordered set.
   * @example "COLLECTION"
   */
  @ApiProperty({ enum: Object.values(ListKindValues) })
  kind!: ListKind;

  /**
   * Who can see the list.
   * @example "PRIVATE"
   */
  @ApiProperty({ enum: Object.values(ListVisibilityValues) })
  visibility!: ListVisibility;

  /**
   * OWNER for the caller's lists, EDITOR for the ones shared with them.
   * @example "OWNER"
   */
  @ApiProperty({ enum: ["OWNER", "EDITOR"] })
  role!: "OWNER" | "EDITOR";

  /**
   * How many items the list holds.
   * @example 14
   */
  itemCount!: number;

  /**
   * When the list was created.
   * @example "2026-03-14T09:26:53.000Z"
   */
  createdAt!: string;

  /**
   * When the list last changed.
   * @example "2026-09-30T21:00:00.000Z"
   */
  updatedAt!: string;
}
