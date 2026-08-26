import type {
  ConfirmTotpResponseDto,
  MfaStatusDto,
  RegenerateRecoveryCodesResponseDto,
  SetEmailMfaResponseDto,
  TotpSetupDto,
} from "@loomkeep/shared";
import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { MfaService } from "../auth/mfa.service";
import { ConfirmTotpDto } from "./dto/confirm-totp.dto";
import { DisableTotpDto } from "./dto/disable-totp.dto";
import { SetEmailMfaDto } from "./dto/set-email-mfa.dto";

/** Authenticated MFA self-management surface, mirroring the `/users/me/...` convention. */
@Controller("users/me/mfa")
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Get()
  getStatus(@CurrentUser() payload: JwtPayload): Promise<MfaStatusDto> {
    return this.mfaService.getMfaStatus(payload.sub);
  }

  @Post("totp/setup")
  setupTotp(@CurrentUser() payload: JwtPayload): Promise<TotpSetupDto> {
    return this.mfaService.generateTotpSetup(payload.sub, payload.email);
  }

  @Post("totp/confirm")
  confirmTotp(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ConfirmTotpDto,
  ): Promise<ConfirmTotpResponseDto> {
    return this.mfaService.confirmTotp(payload.sub, dto.code);
  }

  @Post("totp/disable")
  async disableTotp(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: DisableTotpDto,
  ): Promise<void> {
    await this.mfaService.disableTotp(payload.sub, dto.currentPassword);
  }

  @Patch("email")
  setEmailMfa(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: SetEmailMfaDto,
  ): Promise<SetEmailMfaResponseDto> {
    return this.mfaService.setEmailMfaEnabled(payload.sub, dto.enabled);
  }

  // Authenticated-only, but still a sensitive/spammy-if-abused action.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("recovery-codes/regenerate")
  async regenerateRecoveryCodes(
    @CurrentUser() payload: JwtPayload,
  ): Promise<RegenerateRecoveryCodesResponseDto> {
    return {
      codes: await this.mfaService.regenerateRecoveryCodes(payload.sub),
    };
  }
}
