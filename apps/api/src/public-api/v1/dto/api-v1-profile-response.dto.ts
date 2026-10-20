import type { ApiV1ProfileDto } from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
import { ApiV1ProgressionResponseDto } from "./api-v1-progression-response.dto";
export class ApiV1ProfileResponseDto implements ApiV1ProfileDto {
  /**
   * The account's id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * Unique handle, used in profile URLs.
   * @example "alice"
   */
  username!: string;

  /**
   * Name shown in the app.
   * @example "Alice Martin"
   */
  displayName!: string;

  /**
   * The profile's bio, if any.
   * @example "Mostly anime and slow sci-fi."
   */
  bio!: string | null;

  /**
   * Avatar image, if one was uploaded.
   * @example "https://loomkeep.app/api/users/cm1q2w3e4r5t6y7u8i9o0p1a/avatar"
   */
  avatarUrl!: string | null;

  /**
   * When the account was created.
   * @example "2026-03-14T09:26:53.000Z"
   */
  memberSince!: string;

  /**
   * Level and experience; null when gamification is turned off on this
   * instance.
   */
  @ApiProperty({ type: ApiV1ProgressionResponseDto, nullable: true })
  progression!: ApiV1ProgressionResponseDto | null;
}
