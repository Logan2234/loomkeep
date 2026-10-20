import type { SessionDto } from "@loomkeep/shared";
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import type { JwtPayload } from "./decorators/current-user.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { SessionResponseDto } from "./dto/session-response.dto";
import { RequireRecentAuth } from "./recent-auth.guard";

/**
 * Manage the user's signed-in devices. Lives outside the (@Public) AuthController
 * so these routes go through the global JwtAuthGuard.
 */
@Controller("auth/sessions")
export class SessionsController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @ApiOkResponse({ type: SessionResponseDto, isArray: true })
  listSessions(@CurrentUser() payload: JwtPayload): Promise<SessionDto[]> {
    return this.authService.listSessions(payload.sub, payload.sid);
  }

  // A stolen session mustn't be able to sign its owner out everywhere else.
  /** Revokes every other device, keeping the current signed-in session. */
  @RequireRecentAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete()
  async revokeOthers(@CurrentUser() payload: JwtPayload): Promise<void> {
    if (!payload.sid) return this.authService.revokeAllSessions(payload.sub);
    await this.authService.revokeOtherSessions(payload.sub, payload.sid);
  }

  @RequireRecentAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":id")
  async revokeSession(
    @CurrentUser() payload: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    await this.authService.revokeSession(payload.sub, id);
  }
}
