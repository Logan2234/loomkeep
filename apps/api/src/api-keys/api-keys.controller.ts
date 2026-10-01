import type {
  ApiKeyDto,
  ApiKeyQuotaDto,
  CreatedApiKeyDto,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ApiKeysService } from "./api-keys.service";
import { ApiRateLimitService } from "./api-rate-limit.service";
import { ApiKeyQuotaResponseDto } from "./dto/api-key-quota-response.dto";
import { ApiKeyResponseDto } from "./dto/api-key-response.dto";
import { CreateApiKeyRequestDto } from "./dto/create-api-key.dto";
import { CreatedApiKeyResponseDto } from "./dto/created-api-key-response.dto";

/**
 * Manage the user's API keys. Deliberately not @AllowApiKey: a key can
 * never mint or revoke keys, only a browser session can.
 */
@Controller("api-keys")
export class ApiKeysController {
  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly rateLimit: ApiRateLimitService,
  ) {}

  @Get()
  @ApiOkResponse({ type: ApiKeyResponseDto, isArray: true })
  list(@CurrentUser() user: JwtPayload): Promise<ApiKeyDto[]> {
    return this.apiKeys.list(user.sub);
  }

  @Get("quota")
  @ApiOkResponse({ type: ApiKeyQuotaResponseDto })
  quota(@CurrentUser() user: JwtPayload): Promise<ApiKeyQuotaDto> {
    return this.rateLimit.quota(user.sub);
  }

  @Post()
  @ApiCreatedResponse({ type: CreatedApiKeyResponseDto })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateApiKeyRequestDto,
  ): Promise<CreatedApiKeyDto> {
    return this.apiKeys.create(user.sub, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":id")
  async revoke(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    await this.apiKeys.revoke(user.sub, id);
  }
}
