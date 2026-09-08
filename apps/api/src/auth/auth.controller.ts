import {
  ErrorCode,
  type LoginResponseDto,
  type UserDto,
  WebauthnLoginOptionsResponseDto,
  WebauthnMfaOptionsResponseDto,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AppException } from "../common/app.exception";
import {
  clearAuthCookies,
  readRefreshCookie,
  setAuthCookies,
} from "./auth-cookies";
import { AuthService } from "./auth.service";
import { Public } from "./decorators/public.decorator";
import { AuthResultResponseDto } from "./dto/auth-result-response.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import {
  LoginMfaChallengeResponseDto,
  LoginSuccessResponseDto,
} from "./dto/login-response.dto";
import { LoginDto } from "./dto/login.dto";
import { MfaVerifyDto } from "./dto/mfa-verify.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResendMfaEmailCodeDto } from "./dto/resend-mfa-email-code.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { WebauthnLoginOptionsResultDto } from "./dto/webauthn-login-options-response.dto";
import { WebauthnLoginOptionsDto } from "./dto/webauthn-login-options.dto";
import { WebauthnLoginVerifyDto } from "./dto/webauthn-login-verify.dto";
import { WebauthnMfaOptionsResultDto } from "./dto/webauthn-mfa-options-response.dto";
import { WebauthnMfaOptionsDto } from "./dto/webauthn-mfa-options.dto";
import { WebauthnMfaVerifyDto } from "./dto/webauthn-mfa-verify.dto";

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
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Headers("user-agent") userAgent?: string,
    @Ip() ip?: string,
    @Headers("accept-language") acceptLanguage?: string,
  ): Promise<{ user: UserDto }> {
    const result = await this.authService.register(
      dto,
      userAgent,
      ip,
      acceptLanguage,
    );
    setAuthCookies(reply, result.tokens);
    return { user: result.user };
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
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Headers("user-agent") userAgent?: string,
    @Ip() ip?: string,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(dto, userAgent, ip);
    if (result.mfaRequired) return result;

    setAuthCookies(reply, result.tokens);
    return { mfaRequired: false, user: result.user };
  }

  // Same budget as login — this is its natural continuation for MFA-enabled accounts.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResultResponseDto })
  @Post("mfa/verify")
  async mfaVerify(
    @Body() dto: MfaVerifyDto,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Headers("user-agent") userAgent?: string,
    @Ip() ip?: string,
  ): Promise<{ user: UserDto }> {
    const result = await this.authService.verifyMfaLogin(
      dto.challengeId,
      dto.code,
      userAgent,
      ip,
    );
    setAuthCookies(reply, result.tokens);
    return { user: result.user };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("mfa/resend-email-code")
  async mfaResendEmailCode(@Body() dto: ResendMfaEmailCodeDto): Promise<void> {
    await this.authService.resendMfaEmailCode(dto.challengeId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WebauthnMfaOptionsResultDto })
  @Post("mfa/webauthn/options")
  mfaWebauthnOptions(
    @Body() dto: WebauthnMfaOptionsDto,
  ): Promise<WebauthnMfaOptionsResponseDto> {
    return this.authService.startWebauthnMfaChallenge(dto.challengeId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResultResponseDto })
  @Post("mfa/webauthn/verify")
  async mfaWebauthnVerify(
    @Body() dto: WebauthnMfaVerifyDto,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Headers("user-agent") userAgent?: string,
    @Ip() ip?: string,
  ): Promise<{ user: UserDto }> {
    const result = await this.authService.verifyWebauthnMfaLogin(
      dto.webauthnChallengeId,
      dto.response,
      userAgent,
      ip,
    );
    setAuthCookies(reply, result.tokens);
    return { user: result.user };
  }

  // Same budget as login — this is its alternate entry point, no password involved.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WebauthnLoginOptionsResultDto })
  @Post("webauthn/login-options")
  webauthnLoginOptions(
    @Body() dto: WebauthnLoginOptionsDto,
  ): Promise<WebauthnLoginOptionsResponseDto> {
    return this.authService.passwordlessLoginOptions(dto.identifier);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResultResponseDto })
  @Post("webauthn/login-verify")
  async webauthnLoginVerify(
    @Body() dto: WebauthnLoginVerifyDto,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Headers("user-agent") userAgent?: string,
    @Ip() ip?: string,
  ): Promise<{ user: UserDto }> {
    const result = await this.authService.passwordlessLoginVerify(
      dto.webauthnChallengeId,
      dto.response,
      userAgent,
      ip,
    );
    setAuthCookies(reply, result.tokens);
    return { user: result.user };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("refresh")
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const refreshToken = readRefreshCookie(request);

    if (!refreshToken) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthInvalidRefreshToken,
      );
    }

    try {
      setAuthCookies(reply, await this.authService.refresh(refreshToken));
    } catch (error) {
      if (!(error instanceof AppException)) throw error;
      clearAuthCookies(reply);
      throw error;
    }
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const refreshToken = readRefreshCookie(request);
    if (refreshToken) await this.authService.logout(refreshToken);
    clearAuthCookies(reply);
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
