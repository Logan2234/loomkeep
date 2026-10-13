import type {
  ReauthResultDto,
  ReauthStatusDto,
  WebauthnLoginOptionsResponseDto,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { SENSITIVE_ACTION_THROTTLE } from "../common/throttle.constants";
import type { JwtPayload } from "./decorators/current-user.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import {
  ReauthResultResponseDto,
  ReauthStatusResponseDto,
} from "./dto/reauth-response.dto";
import { ReauthDto } from "./dto/reauth.dto";
import { WebauthnLoginOptionsResultDto } from "./dto/webauthn-login-options-response.dto";
import { ReauthService } from "./reauth.service";

/** Confirming it's still you before a sensitive action (see RecentAuthGuard). */
@Controller("auth/reauth")
export class ReauthController {
  constructor(private readonly reauth: ReauthService) {}

  /** The methods this account can confirm with, and this session's confirmation. */
  @Get()
  @ApiOkResponse({ type: ReauthStatusResponseDto })
  status(@CurrentUser() payload: JwtPayload): Promise<ReauthStatusDto> {
    return this.reauth.status(payload.sub, payload.sid);
  }

  @Throttle(SENSITIVE_ACTION_THROTTLE)
  @Post("webauthn-options")
  @ApiCreatedResponse({ type: WebauthnLoginOptionsResultDto })
  webauthnOptions(
    @CurrentUser() payload: JwtPayload,
  ): Promise<WebauthnLoginOptionsResponseDto> {
    return this.reauth.webauthnOptions(payload.sub);
  }

  @Throttle(SENSITIVE_ACTION_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post()
  @ApiOkResponse({ type: ReauthResultResponseDto })
  confirm(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ReauthDto,
  ): Promise<ReauthResultDto> {
    return this.reauth.confirm(payload.sub, payload.sid, dto);
  }
}
