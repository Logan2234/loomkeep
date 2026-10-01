import type { CreatedApiKeyDto } from "@loomkeep/shared";
import { ApiKeyResponseDto } from "./api-key-response.dto";

export class CreatedApiKeyResponseDto implements CreatedApiKeyDto {
  apiKey!: ApiKeyResponseDto;
  secret!: string;
}
