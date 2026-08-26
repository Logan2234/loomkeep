import type { SessionDto } from "@loomkeep/shared";
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { JwtPayload } from "./decorators/current-user.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";

/**
 * Manage the user's signed-in devices. Lives outside the (@Public) AuthController
 * so these routes go through the global JwtAuthGuard.
 */
@Controller("auth/sessions")
export class SessionsController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  listSessions(@CurrentUser() payload: JwtPayload): Promise<SessionDto[]> {
    return this.authService.listSessions(payload.sub);
  }

  /** Revokes every other device, keeping the current one (identified by its jti). */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete()
  async revokeOthers(
    @CurrentUser() payload: JwtPayload,
    @Query("except") exceptJti?: string,
  ): Promise<void> {
    if (!exceptJti) {
      throw new BadRequestException("Missing 'except' query parameter");
    }

    await this.authService.revokeOtherSessions(payload.sub, exceptJti);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":id")
  async revokeSession(
    @CurrentUser() payload: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    await this.authService.revokeSession(payload.sub, id);
  }
}
