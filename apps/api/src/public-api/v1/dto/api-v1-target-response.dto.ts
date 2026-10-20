import type { ApiV1TargetDto, ReviewTargetType } from "@loomkeep/shared";

import { ReviewTargetType as ReviewTargetTypeValues } from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
export class ApiV1TargetResponseDto implements ApiV1TargetDto {
  /**
   * What the target is: a work (MEDIA, GAME, BOOK, MUSIC), a SEASON or an
   * EPISODE.
   * @example "MEDIA"
   */
  @ApiProperty({ enum: Object.values(ReviewTargetTypeValues) })
  type!: ReviewTargetType;

  /**
   * The target's id; for a work, its Loomkeep id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * The target's title; null when it can't be resolved any more.
   * @example "Dune"
   */
  title!: string | null;

  /**
   * Poster or cover image, when there is one.
   * @example "https://covers.openlibrary.org/b/id/11481354-L.jpg"
   */
  imageUrl!: string | null;

  /**
   * Its page in the web app; null for a target without its own page (a
   * season, an episode).
   * @example "https://loomkeep.app/app/books/OL893415W"
   */
  url!: string | null;
}
