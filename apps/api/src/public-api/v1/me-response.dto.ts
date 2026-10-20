import type { ApiKeyScope, ApiV1MeDto } from "@loomkeep/shared";
import { API_KEY_SCOPES } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

class ApiV1MeUserResponseDto {
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
}

class ApiV1MeKeyResponseDto {
  /**
   * The name given to the key when it was created.
   * @example "Homepage"
   */
  name!: string;

  /**
   * What the key can read.
   * @example ["library:read", "calendar:read"]
   */
  @ApiProperty({ enum: API_KEY_SCOPES, isArray: true })
  scopes!: ApiKeyScope[];

  /**
   * When the key stops working; null if it never expires.
   * @example "2027-01-31T00:00:00.000Z"
   */
  expiresAt!: string | null;
}

class ApiV1RateLimitResponseDto {
  /**
   * Requests allowed per minute, shared by all the account's keys.
   * @example 60
   */
  perMinute!: number;
}

export class ApiV1MeResponseDto implements ApiV1MeDto {
  /** The account the key belongs to. */
  user!: ApiV1MeUserResponseDto;

  /** The key the request was made with. */
  @ApiProperty({ type: ApiV1MeKeyResponseDto, nullable: true })
  apiKey!: ApiV1MeKeyResponseDto | null;

  /** The account's request budget. */
  rateLimit!: ApiV1RateLimitResponseDto;
}
