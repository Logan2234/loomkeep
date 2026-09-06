import type {
  ConfirmTotpResponseDto,
  MfaStatusDto,
  RegenerateRecoveryCodesResponseDto,
  SetEmailMfaResponseDto,
  TotpSetupDto,
} from "@loomkeep/shared";
import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { MfaService } from "../auth/mfa.service";
import { ConfirmTotpResultDto } from "./dto/confirm-totp-response.dto";
import { ConfirmTotpDto } from "./dto/confirm-totp.dto";
import { DisableTotpDto } from "./dto/disable-totp.dto";
import { MfaStatusResponseDto } from "./dto/mfa-status-response.dto";
import { RegenerateRecoveryCodesResultDto } from "./dto/regenerate-recovery-codes-response.dto";
import { SetEmailMfaResultDto } from "./dto/set-email-mfa-response.dto";
import { SetEmailMfaDto } from "./dto/set-email-mfa.dto";
import { TotpSetupResponseDto } from "./dto/totp-setup-response.dto";

/** Authenticated MFA self-management surface, mirroring the `/users/me/...` convention. */
@Controller("users/me/mfa")
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Get()
  @ApiOkResponse({ type: MfaStatusResponseDto })
  getStatus(@CurrentUser() payload: JwtPayload): Promise<MfaStatusDto> {
    return this.mfaService.getMfaStatus(payload.sub);
  }

  @Post("totp/setup")
  @ApiCreatedResponse({ type: TotpSetupResponseDto })
  setupTotp(@CurrentUser() payload: JwtPayload): Promise<TotpSetupDto> {
    return this.mfaService.generateTotpSetup(payload.sub, payload.email);
  }

  @Post("totp/confirm")
  @ApiCreatedResponse({ type: ConfirmTotpResultDto })
  confirmTotp(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ConfirmTotpDto,
  ): Promise<ConfirmTotpResponseDto> {
    return this.mfaService.confirmTotp(payload.sub, dto.code, payload.sid);
  }

  @Post("totp/disable")
  async disableTotp(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: DisableTotpDto,
  ): Promise<void> {
    await this.mfaService.disableTotp(
      payload.sub,
      dto.currentPassword,
      payload.sid,
    );
  }

  @Patch("email")
  @ApiOkResponse({ type: SetEmailMfaResultDto })
  setEmailMfa(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: SetEmailMfaDto,
  ): Promise<SetEmailMfaResponseDto> {
    return this.mfaService.setEmailMfaEnabled(
      payload.sub,
      dto.enabled,
      dto.currentPassword,
      payload.sid,
    );
  }

  // Authenticated-only, but still a sensitive/spammy-if-abused action.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("recovery-codes/regenerate")
  @ApiCreatedResponse({ type: RegenerateRecoveryCodesResultDto })
  async regenerateRecoveryCodes(
    @CurrentUser() payload: JwtPayload,
  ): Promise<RegenerateRecoveryCodesResponseDto> {
    return {
      codes: await this.mfaService.regenerateRecoveryCodes(
        payload.sub,
        payload.sid,
      ),
    };
  }
}
