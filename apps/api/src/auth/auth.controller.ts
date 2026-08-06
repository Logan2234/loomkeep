import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { AuthTokensDto } from "@loomkeep/shared";
import { AuthResult, AuthService } from "./auth.service";
import { Public } from "./decorators/public.decorator";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";

@Public()
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Brute-force / abuse guards on top of the global 60 req/min default.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  register(
    @Body() dto: RegisterDto,
    @Headers("user-agent") userAgent?: string,
  ): Promise<AuthResult> {
    return this.authService.register(dto, userAgent);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("login")
  login(
    @Body() dto: LoginDto,
    @Headers("user-agent") userAgent?: string,
  ): Promise<AuthResult> {
    return this.authService.login(dto, userAgent);
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
