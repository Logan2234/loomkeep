import type { ApiKeyScope, ApiV1MeDto } from "@loomkeep/shared";
import { API_KEY_SCOPES } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

class ApiV1MeUserResponseDto {
  id!: string;
  username!: string;
  displayName!: string;
}

class ApiV1MeKeyResponseDto {
  name!: string;
  @ApiProperty({ enum: API_KEY_SCOPES, isArray: true })
  scopes!: ApiKeyScope[];

  expiresAt!: string | null;
}

class ApiV1RateLimitResponseDto {
  perMinute!: number;
}

export class ApiV1MeResponseDto implements ApiV1MeDto {
  user!: ApiV1MeUserResponseDto;
  @ApiProperty({ type: ApiV1MeKeyResponseDto, nullable: true })
  apiKey!: ApiV1MeKeyResponseDto | null;

  rateLimit!: ApiV1RateLimitResponseDto;
}
