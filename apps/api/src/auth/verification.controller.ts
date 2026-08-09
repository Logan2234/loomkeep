import { Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import type { JwtPayload } from "./decorators/current-user.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";

@Controller("auth/verification")
export class VerificationController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("resend")
  async resend(@CurrentUser() payload: JwtPayload): Promise<void> {
    await this.authService.resendVerificationEmail(payload.sub);
  }
}
