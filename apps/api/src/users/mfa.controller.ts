import type {
  ConfirmTotpResponseDto,
  MfaStatusDto,
  RegenerateRecoveryCodesResponseDto,
  RemoveWebauthnCredentialResponseDto,
  RenameWebauthnCredentialResponseDto,
  SetEmailMfaResponseDto,
  TotpSetupDto,
  WebauthnRegistrationOptionsDto,
  WebauthnRegistrationVerifyResponseDto,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { MfaService } from "../auth/mfa.service";
import { RequireRecentAuth } from "../auth/recent-auth.guard";
import { WebauthnService } from "../auth/webauthn.service";
import { SENSITIVE_ACTION_THROTTLE } from "../common/throttle.constants";
import { ConfirmTotpResultDto } from "./dto/confirm-totp-response.dto";
import { ConfirmTotpDto } from "./dto/confirm-totp.dto";
import { MfaStatusResponseDto } from "./dto/mfa-status-response.dto";
import { RegenerateRecoveryCodesResultDto } from "./dto/regenerate-recovery-codes-response.dto";
import { RemoveWebauthnCredentialResultDto } from "./dto/remove-webauthn-credential-response.dto";
import { RenameWebauthnCredentialResultDto } from "./dto/rename-webauthn-credential-response.dto";
import { RenameWebauthnCredentialDto } from "./dto/rename-webauthn-credential.dto";
import { SetEmailMfaResultDto } from "./dto/set-email-mfa-response.dto";
import { SetEmailMfaDto } from "./dto/set-email-mfa.dto";
import { SetPasswordlessDto } from "./dto/set-passwordless.dto";
import { TotpSetupResponseDto } from "./dto/totp-setup-response.dto";
import { WebauthnRegistrationOptionsResponseDto } from "./dto/webauthn-registration-options-response.dto";
import { WebauthnRegistrationVerifyResultDto } from "./dto/webauthn-registration-verify-response.dto";
import { WebauthnRegistrationVerifyDto } from "./dto/webauthn-registration-verify.dto";

/** Authenticated MFA self-management surface, mirroring the `/users/me/...` convention. */
@Controller("users/me/mfa")
export class MfaController {
  constructor(
    private readonly mfaService: MfaService,
    private readonly webauthnService: WebauthnService,
  ) {}

  @Get()
  @ApiOkResponse({ type: MfaStatusResponseDto })
  async getStatus(@CurrentUser() payload: JwtPayload): Promise<MfaStatusDto> {
    const [status, webauthn] = await Promise.all([
      this.mfaService.getMfaStatus(payload.sub),
      this.webauthnService.getStatus(payload.sub),
    ]);
    return { ...status, ...webauthn };
  }

  @RequireRecentAuth()
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
    @Headers("user-agent") userAgent?: string,
  ): Promise<ConfirmTotpResponseDto> {
    return this.mfaService.confirmTotp(
      payload.sub,
      dto.code,
      payload.sid,
      userAgent,
    );
  }

  @RequireRecentAuth()
  @Post("totp/disable")
  async disableTotp(
    @CurrentUser() payload: JwtPayload,
    @Headers("user-agent") userAgent?: string,
  ): Promise<void> {
    await this.mfaService.disableTotp(payload.sub, payload.sid, userAgent);
  }

  @RequireRecentAuth()
  @Patch("email")
  @ApiOkResponse({ type: SetEmailMfaResultDto })
  setEmailMfa(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: SetEmailMfaDto,
    @Headers("user-agent") userAgent?: string,
  ): Promise<SetEmailMfaResponseDto> {
    return this.mfaService.setEmailMfaEnabled(
      payload.sub,
      dto.enabled,
      payload.sid,
      userAgent,
    );
  }

  // Authenticated-only, but still a sensitive/spammy-if-abused action.
  @Throttle(SENSITIVE_ACTION_THROTTLE)
  @RequireRecentAuth()
  @Post("recovery-codes/regenerate")
  @ApiCreatedResponse({ type: RegenerateRecoveryCodesResultDto })
  async regenerateRecoveryCodes(
    @CurrentUser() payload: JwtPayload,
    @Headers("user-agent") userAgent?: string,
  ): Promise<RegenerateRecoveryCodesResponseDto> {
    return {
      codes: await this.mfaService.regenerateRecoveryCodes(
        payload.sub,
        payload.sid,
        userAgent,
      ),
    };
  }

  @RequireRecentAuth()
  @Post("webauthn/register-options")
  @ApiCreatedResponse({ type: WebauthnRegistrationOptionsResponseDto })
  registerWebauthnOptions(
    @CurrentUser() payload: JwtPayload,
  ): Promise<WebauthnRegistrationOptionsDto> {
    return this.webauthnService.registrationOptions(
      payload.sub,
      payload.email,
      payload.email,
    );
  }

  @Post("webauthn/register-verify")
  @ApiCreatedResponse({ type: WebauthnRegistrationVerifyResultDto })
  registerWebauthnVerify(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: WebauthnRegistrationVerifyDto,
  ): Promise<WebauthnRegistrationVerifyResponseDto> {
    return this.webauthnService.verifyRegistration(payload.sub, dto);
  }

  @RequireRecentAuth()
  @Delete("webauthn/:credentialId")
  @ApiOkResponse({ type: RemoveWebauthnCredentialResultDto })
  removeWebauthnCredential(
    @CurrentUser() payload: JwtPayload,
    @Param("credentialId") credentialId: string,
  ): Promise<RemoveWebauthnCredentialResponseDto> {
    return this.webauthnService.removeCredential(
      payload.sub,
      credentialId,
      payload.sid,
    );
  }

  @Patch("webauthn/:credentialId")
  @ApiOkResponse({ type: RenameWebauthnCredentialResultDto })
  renameWebauthnCredential(
    @CurrentUser() payload: JwtPayload,
    @Param("credentialId") credentialId: string,
    @Body() dto: RenameWebauthnCredentialDto,
  ): Promise<RenameWebauthnCredentialResponseDto> {
    return this.webauthnService.renameCredential(
      payload.sub,
      credentialId,
      dto.name,
    );
  }

  @RequireRecentAuth()
  @Patch("passwordless")
  async setPasswordless(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: SetPasswordlessDto,
  ): Promise<void> {
    await this.webauthnService.setPasswordless(
      payload.sub,
      dto.enabled,
      payload.sid,
    );
  }
}
