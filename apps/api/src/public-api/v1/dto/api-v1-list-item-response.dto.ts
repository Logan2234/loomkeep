import type { ApiV1ListItemDto } from "@loomkeep/shared";

import { ApiV1TargetResponseDto } from "./api-v1-target-response.dto";
export class ApiV1ListItemResponseDto implements ApiV1ListItemDto {
  /**
   * The item's id within the list.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * Its place in the list, from 0.
   * @example 0
   */
  position!: number;

  /**
   * When it was added to the list.
   * @example "2026-09-30T21:00:00.000Z"
   */
  addedAt!: string;

  /** The work, season or episode. */
  target!: ApiV1TargetResponseDto;
}
