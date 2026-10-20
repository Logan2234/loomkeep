import type { ApiKeyDto, ApiKeyScope } from "@loomkeep/shared";
import { API_KEY_SCOPES } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

export class ApiKeyResponseDto implements ApiKeyDto {
  id!: string;
  name!: string;
  suffix!: string;
  @ApiProperty({ enum: API_KEY_SCOPES, isArray: true })
  scopes!: ApiKeyScope[];

  expiresAt!: string | null;
  lastUsedAt!: string | null;
  lastUsedIp!: string | null;
  createdAt!: string;
}
