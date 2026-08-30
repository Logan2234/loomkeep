import type { AuthTokensDto, LoginResponseDto } from "@loomkeep/shared";
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthResult, AuthService } from "./auth.service";
import { Public } from "./decorators/public.decorator";
import { AuthResultResponseDto } from "./dto/auth-result-response.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import {
  LoginMfaChallengeResponseDto,
  LoginSuccessResponseDto,
} from "./dto/login-response.dto";
import { LoginDto } from "./dto/login.dto";
import { MfaVerifyDto } from "./dto/mfa-verify.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResendMfaEmailCodeDto } from "./dto/resend-mfa-email-code.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";

@Public()
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Brute-force / abuse guards on top of the global 60 req/min default.
  // 10, not something tighter, partly so the e2e suite's own sequential
  // /auth/register calls (app.e2e-spec.ts) stay well under the budget —
  // bump this further alongside adding another one there.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiCreatedResponse({ type: AuthResultResponseDto })
  @Post("register")
  register(
    @Body() dto: RegisterDto,
    @Headers("user-agent") userAgent?: string,
    @Ip() ip?: string,
    @Headers("accept-language") acceptLanguage?: string,
  ): Promise<AuthResult> {
    return this.authService.register(dto, userAgent, ip, acceptLanguage);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiExtraModels(LoginMfaChallengeResponseDto, LoginSuccessResponseDto)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(LoginMfaChallengeResponseDto) },
        { $ref: getSchemaPath(LoginSuccessResponseDto) },
      ],
    },
  })
  @Post("login")
  login(
    @Body() dto: LoginDto,
    @Headers("user-agent") userAgent?: string,
    @Ip() ip?: string,
  ): Promise<LoginResponseDto> {
    return this.authService.login(dto, userAgent, ip);
  }

  // Same budget as login — this is its natural continuation for MFA-enabled accounts.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResultResponseDto })
  @Post("mfa/verify")
  async mfaVerify(
    @Body() dto: MfaVerifyDto,
    @Headers("user-agent") userAgent?: string,
    @Ip() ip?: string,
  ): Promise<AuthResult> {
    return this.authService.verifyMfaLogin(
      dto.challengeId,
      dto.code,
      userAgent,
      ip,
    );
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("mfa/resend-email-code")
  async mfaResendEmailCode(@Body() dto: ResendMfaEmailCodeDto): Promise<void> {
    await this.authService.resendMfaEmailCode(dto.challengeId);
  }

  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  async refresh(@Body() dto: RefreshDto): Promise<{ tokens: AuthTokensDto }> {
    return { tokens: await this.authService.refresh(dto.refreshToken) };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("forgot-password")
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.authService.requestPasswordReset(dto.email);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("reset-password")
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Headers("user-agent") userAgent?: string,
  ): Promise<void> {
    await this.authService.resetPassword(dto.token, dto.newPassword, userAgent);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("verify-email")
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<void> {
    await this.authService.verifyEmail(dto.token);
  }
}
